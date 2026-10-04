import { BackendError } from './core.mjs';
import { activeCall, hash, id, member } from './records.mjs';
export function callDto(record, uid) { member(record, uid); const other = record.participants.find((value) => value !== uid); const { peers, participants, heartbeat, connectedBy, seq, ...value } = record; return { ...value, peer: peers[other] }; }
export function createCalls({ store, accounts, chat, now = Date.now, env = () => undefined }) {
  function stale(record) { return activeCall(record) && (record.status === 'ringing' ? now() - record.createdAt > 40000 : record.participants.some((uid) => now() - record.heartbeat[uid] > 45000)); }
  async function finish(tx, record, status, reason) {
    const saved = { ...record, status, reason, endedAt: now(), expiresAt: null }; tx.set(`voiceCalls/${record.id}`, saved);
    for (const uid of record.participants) { const state = await tx.get(`callState/${uid}`); if (state?.callId === record.id) tx.set(`callState/${uid}`, { callId: null }); }
    const signals = await tx.query(`voiceCalls/${record.id}/signals`, [], { limit: 300 }); for (const signal of signals) tx.delete(`voiceCalls/${record.id}/signals/${signal.id}`);
    const conversation = await tx.get(`conversations/${record.conversationId}`);
    if (conversation) await chat.append(tx, conversation, record.callerId, status === 'missed' ? 'Missed voice call' : status === 'declined' ? 'Voice call declined' : record.connectedAt ? `Voice call ended • ${Math.floor((now() - record.connectedAt) / 1000)} seconds` : 'Voice call ended', `call_${record.id}`, { markRead: false });
    return saved;
  }
  return { stale, finish, async handle(uid, path, body, method) {
    if (path === '/calls/ice' && method === 'GET') {
      const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
      // An owner-supplied relay is optional; credentials stay out of source control.
      if (env('TURN_URL') && env('TURN_USERNAME') && env('TURN_CREDENTIAL')) iceServers.push({ urls: env('TURN_URL'), username: env('TURN_USERNAME'), credential: env('TURN_CREDENTIAL') });
      return { iceServers };
    }
    if (path === '/calls' && method === 'POST') {
      const conversationId = id(body.conversationId); const callId = await hash(`${uid}\0${id(body.clientId)}`);
      return store.transact(async (tx) => {
        const [previous, storedConversation] = await tx.getAll([`voiceCalls/${callId}`, `conversations/${conversationId}`]);
        if (previous) { if (previous.conversationId !== conversationId || previous.callerId !== uid) throw new BackendError('This call request was already used.', 409); return { call: callDto(previous, uid) }; }
        const conversation = member(storedConversation, uid); const other = conversation.participants.find((value) => value !== uid);
        const states = await tx.getAll(conversation.participants.map((participant) => `callState/${participant}`));
        for (const [index, participant] of conversation.participants.entries()) {
          const state = states[index]; const current = state?.callId && await tx.get(`voiceCalls/${state.callId}`);
          if (stale(current)) await finish(tx, current, current.status === 'ringing' ? 'missed' : 'ended', 'connection-timeout');
          else if (activeCall(current)) throw new BackendError(participant === uid ? 'You already have an active call.' : 'This user is already on a call.', 409);
        }
        const [caller, callee] = await Promise.all([accounts.peer(uid, tx), accounts.peer(other, tx)]);
        const peers = { [uid]: caller, [other]: callee };
        const record = { id: callId, conversationId, participants: [uid, other], callerId: uid, calleeId: other, peers, status: 'ringing', createdAt: now(), acceptedAt: null, connectedAt: null, endedAt: null, reason: null, heartbeat: { [uid]: now(), [other]: now() }, connectedBy: [], seq: 0, expiresAt: now() + 40001 };
        tx.set(`voiceCalls/${callId}`, record); for (const participant of record.participants) tx.set(`callState/${participant}`, { callId }); return { call: callDto(record, uid) };
      });
    }
    const match = path.match(/^\/calls\/([\w-]+)\/(accept|decline|end|heartbeat|connected|signals|expire)$/);
    if (!match || method !== 'POST') return undefined;
    const signalKey = match[2] === 'signals' ? `${uid}_${id(body.clientId)}` : null;
    return store.transact(async (tx) => {
      const callPath = `voiceCalls/${id(match[1])}`;
      const [stored, previousSignal] = signalKey ? await tx.getAll([callPath, `${callPath}/signals/${signalKey}`]) : [await tx.get(callPath)];
      let record = member(stored, uid); const action = match[2];
      if (stale(record)) record = await finish(tx, record, record.status === 'ringing' ? 'missed' : 'ended', 'connection-timeout');
      if (!activeCall(record)) { if (action === 'signals') throw new BackendError('This call has ended.', 409); return { call: callDto(record, uid) }; }
      if (action === 'signals') {
        const clientId = id(body.clientId); const type = body.type; const payload = body.payload;
        if (!['offer', 'answer', 'ice'].includes(type) || !payload || JSON.stringify(payload).length > 70000) throw new BackendError('Invalid call signal.', 400);
        if (type === 'offer' || type === 'answer') {
          if ((type === 'offer') !== (uid === record.callerId) || payload.type !== type || typeof payload.sdp !== 'string' || payload.sdp.length > 65000 || !payload.sdp.startsWith('v=0') || !/^m=audio /m.test(payload.sdp) || /^m=(video|application) /m.test(payload.sdp)) throw new BackendError('Invalid voice description.', 400);
        } else if (typeof payload.candidate !== 'string' || payload.candidate.length > 4096 || (payload.sdpMid != null && (typeof payload.sdpMid !== 'string' || payload.sdpMid.length > 100)) || (payload.sdpMLineIndex != null && (!Number.isSafeInteger(payload.sdpMLineIndex) || payload.sdpMLineIndex < 0 || payload.sdpMLineIndex > 20))) throw new BackendError('Invalid voice candidate.', 400);
        const signalId = `${uid}_${clientId}`; const previous = previousSignal;
        if (previous) { if (previous.type !== type || JSON.stringify(previous.payload) !== JSON.stringify(payload)) throw new BackendError('This signal request was already used.', 409); return {}; }
        if (record.seq >= 256) throw new BackendError('This call generated too many connection attempts. End it and retry.', 409);
        tx.set(`voiceCalls/${record.id}/signals/${signalId}`, { id: signalId, seq: record.seq + 1, fromUid: uid, toUid: record.participants.find((value) => value !== uid), type, payload }); tx.set(`voiceCalls/${record.id}`, { ...record, seq: record.seq + 1 }); return {};
      }
      if (action === 'accept' || action === 'decline') {
        if (uid !== record.calleeId) throw new BackendError('Only the called user can answer this call.', 403);
        if (record.status !== 'ringing') return { call: callDto(record, uid) };
        if (action === 'decline') return { call: callDto(await finish(tx, record, 'declined', 'declined'), uid) };
        record = { ...record, status: 'accepted', acceptedAt: now(), heartbeat: Object.fromEntries(record.participants.map((value) => [value, now()])) };
      }
      if (action === 'end') return { call: callDto(await finish(tx, record, 'ended', ['cancelled', 'hangup', 'connection-failed', 'connection-lost', 'background', 'logout'].includes(body.reason) ? body.reason : 'hangup'), uid) };
      if (action === 'connected') {
        if (record.status !== 'accepted') throw new BackendError('Answer the call before connecting.', 409);
        const connectedBy = [...new Set([...record.connectedBy, uid])]; record = { ...record, connectedBy, connectedAt: connectedBy.length === 2 ? record.connectedAt ?? now() : null };
      }
      if (action !== 'expire') record = { ...record, heartbeat: { ...record.heartbeat, [uid]: now() } };
      record.expiresAt = record.status === 'ringing' ? record.createdAt + 40001 : Math.min(...Object.values(record.heartbeat)) + 45001;
      tx.set(`voiceCalls/${record.id}`, record); return { call: callDto(record, uid) };
    });
  } };
}
