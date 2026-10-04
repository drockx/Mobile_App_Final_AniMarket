import { isActiveCall, type VoiceCall, type VoiceCandidate, type VoiceDescription, type VoiceMedia, type VoiceRepository, type VoiceSignal } from '../domain/voice_call';

type Phase = 'idle' | 'preparing' | 'incoming' | 'outgoing' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'error';
export type VoiceSnapshot = { call: VoiceCall | null; phase: Phase; muted: boolean; speaker: boolean; supportsSpeaker: boolean; connectedAt: number | null; error: string; busy: boolean };
const empty: VoiceSnapshot = { call: null, phase: 'idle', muted: false, speaker: false, supportsSpeaker: false, connectedAt: null, error: '', busy: false };
const requestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Unable to connect this voice call. Please try again.';

export function createVoiceService(repository: VoiceRepository, createMedia: () => VoiceMedia) {
  let snapshot = { ...empty }; let userId = ''; let accountKey = ''; let epoch = 0; let foreground = true;
  let controller: AbortController | null = null; let cursor: number | null = null;
  let media: VoiceMedia | null = null; let ready = false; let after = 0; let remoteReady = false; let localReady = false;
  let signals: VoiceSignal[] = []; let candidates: VoiceCandidate[] = []; let processing: VoiceMedia | null = null; let attempt = 0;
  let sending: Promise<void> = Promise.resolve(); let heartbeat: ReturnType<typeof setInterval> | undefined;
  let connectionTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>(); const completed = new Set<string>();
  const publish = (next: Partial<VoiceSnapshot>) => { snapshot = { ...snapshot, ...next }; listeners.forEach((listener) => listener()); };
  function cleanMedia() {
    attempt++; processing = null;
    clearInterval(heartbeat); clearTimeout(connectionTimer); heartbeat = undefined; connectionTimer = undefined;
    const current = media; media = null; ready = false; remoteReady = false; localReady = false; signals = []; candidates = []; after = 0;
    current?.close();
  }
  function updateCall(call: VoiceCall) {
    if (completed.has(call.id) && isActiveCall(call)) return;
    if (snapshot.call?.id !== call.id) return;
    if (snapshot.call.status === 'accepted' && call.status === 'ringing') return;
    if (!isActiveCall(call)) {
      completed.add(call.id); cleanMedia();
      publish({ call, phase: 'ended', busy: false, muted: false, speaker: false });
    } else {
      if (call.status === 'accepted' && snapshot.call.status === 'ringing' && media && snapshot.phase !== 'connected') {
        const peer = media;
        clearTimeout(connectionTimer);
        connectionTimer = setTimeout(() => { if (media === peer && snapshot.phase !== 'connected') fail(new Error('The audio connection timed out. Check your network and call again.')); }, 30000);
      }
      publish({ call, ...(call.status === 'accepted' && ['incoming', 'outgoing'].includes(snapshot.phase) ? { phase: 'connecting' as const } : {}) });
    }
  }
  async function terminate(reason?: string) {
    const call = snapshot.call; const requestEpoch = epoch;
    if (call) completed.add(call.id);
    cleanMedia(); publish({ ...(call ? { call: { ...call, status: 'ended' as const, endedAt: Date.now(), reason: reason ?? 'hangup' } } : {}), phase: call ? 'ended' : 'idle', busy: false, muted: false, speaker: false });
    if (!call || !isActiveCall(call)) return;
    try { const ended = await repository.action(call.id, 'end', reason); if (requestEpoch === epoch) updateCall(ended); }
    catch (error) { if (requestEpoch === epoch) publish({ error: `${errorText(error)} Audio is stopped; the server will close the call automatically.` }); }
  }
  function fail(error: unknown) { publish({ error: errorText(error) }); void terminate('connection-lost'); }
  function sendSignal(type: VoiceSignal['type'], payload: VoiceSignal['payload']) {
    const call = snapshot.call; const requestEpoch = epoch; const clientId = requestId();
    if (!call || completed.has(call.id)) return Promise.resolve();
    const task = sending.then(async () => {
      if (requestEpoch !== epoch || snapshot.call?.id !== call.id || completed.has(call.id)) return;
      // Retry once using the same key; a lost acknowledgement must not duplicate SDP/ICE.
      try { await repository.signal(call.id, type, payload, clientId); }
      catch { if (requestEpoch === epoch && !completed.has(call.id)) await repository.signal(call.id, type, payload, clientId); }
    });
    sending = task.catch((error) => { if (requestEpoch === epoch && !completed.has(call.id)) fail(error); });
    return task;
  }
  async function flushCandidates() {
    const queued = candidates; candidates = [];
    const requestEpoch = epoch, peer = media, callId = snapshot.call?.id;
    for (const value of queued) {
      if (requestEpoch !== epoch || media !== peer || snapshot.call?.id !== callId || completed.has(callId ?? '')) return;
      await sendSignal('ice', value);
    }
  }
  async function processSignals() {
    if (!ready || !media || processing === media || !snapshot.call || completed.has(snapshot.call.id)
      || (snapshot.call.calleeId === userId && snapshot.call.status !== 'accepted')) return;
    const requestEpoch = epoch; const peer = media; processing = peer;
    try {
      while (signals.length && requestEpoch === epoch && media === peer) {
        const signal = signals[0];
        if (signal.type === 'ice' && !remoteReady) {
          const description = signals.findIndex((entry) => entry.type !== 'ice');
          if (description < 0) break;
          signals.unshift(...signals.splice(description, 1)); continue;
        }
        signals.shift();
        if (signal.type === 'offer') {
          const answer = await peer.answer(signal.payload as VoiceDescription);
          if (requestEpoch !== epoch || media !== peer) return;
          remoteReady = true; await sendSignal('answer', answer);
          if (requestEpoch !== epoch || media !== peer) return;
          localReady = true; await flushCandidates();
        } else if (signal.type === 'answer') {
          await peer.applyAnswer(signal.payload as VoiceDescription);
          if (requestEpoch !== epoch || media !== peer) return;
          remoteReady = true;
        }
        else await peer.addCandidate(signal.payload as VoiceCandidate);
      }
    } catch (error) { if (requestEpoch === epoch && media === peer) fail(error); }
    finally { if (processing === peer) processing = null; }
  }
  async function prepare() {
    const requestEpoch = epoch; const peer = createMedia(); media = peer;
    try {
      const ice = await repository.ice();
      if (requestEpoch !== epoch || media !== peer) { peer.close(); throw new Error('Call cancelled.'); }
      await peer.prepare(ice, {
        candidate(value) {
          if (requestEpoch !== epoch || media !== peer) return;
          // Send the description first so early candidates cannot delay the offer/answer.
          if (ready && localReady && snapshot.call) void sendSignal('ice', value).catch(() => {});
          else candidates.push(value);
        },
        connection(state) {
          if (requestEpoch !== epoch || media !== peer || !isActiveCall(snapshot.call)) return;
          if (state === 'connected') {
            clearTimeout(connectionTimer); publish({ phase: 'connected', connectedAt: snapshot.connectedAt ?? Date.now(), error: '' });
            const id = snapshot.call!.id;
            void repository.action(id, 'connected').then((call) => { if (requestEpoch === epoch) updateCall(call); }).catch((error) => { if (requestEpoch === epoch && media === peer) fail(error); });
          } else if (state === 'disconnected') {
            publish({ phase: 'reconnecting' }); clearTimeout(connectionTimer);
            connectionTimer = setTimeout(() => { if (media === peer) fail(new Error('The audio connection was lost. Please call again.')); }, 15000);
          } else if (state === 'failed') fail(new Error('Could not establish an audio connection. Check your network and try again.'));
        },
      });
      if (requestEpoch !== epoch || media !== peer) { peer.close(); throw new Error('Call cancelled.'); }
      ready = true; publish({ supportsSpeaker: peer.supportsSpeaker });
    } catch (error) { peer.close(); if (media === peer) media = null; throw error; }
  }
  function startHeartbeat() {
    clearInterval(heartbeat);
    heartbeat = setInterval(() => {
      const call = snapshot.call; const requestEpoch = epoch;
      if (isActiveCall(call)) void repository.action(call!.id, 'heartbeat').then((value) => {
        if (requestEpoch === epoch) updateCall(value);
      }).catch((error) => { if (requestEpoch === epoch) publish({ error: errorText(error) }); });
    }, 10000);
  }
  function stopPoll() { controller?.abort(); controller = null; }
  function poll() {
    if (!userId || !foreground || controller) return;
    const own = new AbortController(); controller = own; const requestEpoch = epoch;
    void (async () => {
      while (!own.signal.aborted && requestEpoch === epoch) {
        try {
          const result = await repository.sync(cursor, snapshot.call?.id ?? '', after, own.signal);
          if (own.signal.aborted || requestEpoch !== epoch) return;
          cursor = result.cursor;
          if (result.call && result.call.status === 'ringing' && snapshot.call?.id !== result.call.id && !completed.has(result.call.id)
            && result.call.calleeId === userId && !snapshot.busy && !isActiveCall(snapshot.call)) {
            cleanMedia(); publish({ ...empty, call: result.call, phase: 'incoming' }); cursor = null;
          } else if (result.call && result.call.id === snapshot.call?.id) updateCall(result.call);
          if (result.call?.id === snapshot.call?.id) for (const signal of result.signals) if (signal.seq > after && isActiveCall(snapshot.call)) { signals.push(signal); after = signal.seq; }
          await processSignals();
        } catch (error) {
          if (own.signal.aborted || requestEpoch !== epoch) return;
          publish({ error: errorText(error) });
          await new Promise<void>((resolve) => {
            const finish = () => { clearTimeout(timer); own.signal.removeEventListener('abort', finish); resolve(); };
            const timer = setTimeout(finish, 2000); own.signal.addEventListener('abort', finish, { once: true });
          });
          cursor = null;
        }
      }
    })();
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    connect(id: string, key: string) {
      if (id === userId && key === accountKey) return;
      epoch++; stopPoll(); cleanMedia(); sending = Promise.resolve(); completed.clear();
      userId = id; accountKey = key; cursor = null; publish({ ...empty }); poll();
    },
    setActive(active: boolean) {
      foreground = active;
      if (!active) { stopPoll(); if (isActiveCall(snapshot.call) || snapshot.busy) void terminate('connection-lost'); }
      else { cursor = null; poll(); }
    },
    async start(conversationId: string) {
      if (!userId) throw new Error('Please sign in to call another user.');
      if (snapshot.busy || isActiveCall(snapshot.call)) throw new Error('Finish your current call first.');
      const requestEpoch = epoch; const operation = ++attempt; publish({ ...empty, phase: 'preparing', busy: true });
      const clientId = requestId();
      try {
        await prepare();
        if (requestEpoch !== epoch || operation !== attempt) return;
        let call: VoiceCall;
        try { call = await repository.start(conversationId, clientId); }
        catch (error) {
          if (requestEpoch !== epoch || operation !== attempt) throw error;
          call = await repository.start(conversationId, clientId);
        }
        if (requestEpoch !== epoch) return;
        if (operation !== attempt || !media) { await repository.action(call.id, 'end'); return; }
        publish({ call, phase: 'outgoing' }); cursor = null; startHeartbeat();
        const offer = await media.offer();
        if (requestEpoch !== epoch || completed.has(call.id)) return;
        await sendSignal('offer', offer);
        if (requestEpoch !== epoch || operation !== attempt || !media || completed.has(call.id)) return;
        localReady = true; publish({ busy: false }); await flushCandidates();
      } catch (error) {
        if (requestEpoch === epoch && operation === attempt) { if (snapshot.call) await terminate('connection-lost'); else { cleanMedia(); publish({ phase: 'error', busy: false }); } publish({ error: errorText(error) }); }
        throw error;
      }
    },
    async accept() {
      const call = snapshot.call; if (!call || snapshot.phase !== 'incoming' || snapshot.busy) return;
      const requestEpoch = epoch; const operation = ++attempt; publish({ busy: true, error: '' });
      try {
        await prepare();
        if (requestEpoch !== epoch || operation !== attempt || !media || !isActiveCall(snapshot.call)) return;
        const accepted = await repository.action(call.id, 'accept');
        if (requestEpoch !== epoch || operation !== attempt || !media) return;
        updateCall(accepted); publish({ busy: false }); startHeartbeat(); await processSignals();
      } catch (error) { if (requestEpoch === epoch && operation === attempt) { cleanMedia(); cursor = null; publish({ busy: false, error: errorText(error) }); } }
    },
    async decline() {
      const call = snapshot.call; if (!call || snapshot.busy) return;
      const requestEpoch = epoch; cleanMedia(); completed.add(call.id); publish({ call: { ...call, status: 'declined', endedAt: Date.now(), reason: 'declined' }, phase: 'ended' });
      try { const value = await repository.action(call.id, 'decline'); if (requestEpoch === epoch) updateCall(value); }
      catch (error) { if (requestEpoch === epoch) publish({ error: errorText(error) }); }
    },
    end: () => terminate(),
    dismiss() { if (!isActiveCall(snapshot.call) && !snapshot.busy) publish({ ...empty }); },
    toggleMute() { if (media && ready) { try { media.mute(!snapshot.muted); publish({ muted: !snapshot.muted }); } catch (error) { publish({ error: errorText(error) }); } } },
    toggleSpeaker() { if (media && ready && media.supportsSpeaker) { try { media.speaker(!snapshot.speaker); publish({ speaker: !snapshot.speaker }); } catch (error) { publish({ error: errorText(error) }); } } },
  };
}
export type VoiceService = ReturnType<typeof createVoiceService>;
