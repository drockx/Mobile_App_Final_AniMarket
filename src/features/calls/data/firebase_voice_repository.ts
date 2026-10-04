import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { getFirebaseServices } from '@/services/firebase';
import { requireFirebaseUser } from '@/services/firebase_identity';
import { createLiveSync } from '@/services/live_sync';
import { cloudBackendRequest } from '@/services/supabase';
import type { IceServer, VoiceCall, VoiceRepository, VoiceSignal } from '../domain/voice_call';

const state = createLiveSync<{ call: VoiceCall | null; signals: VoiceSignal[] }>({ call: null, signals: [] });
let uid = '', callId = '', accountVersion = 0, callVersion = 0;
let stopState: (() => void) | undefined, stopCall: (() => void) | undefined, stopSignals: (() => void) | undefined;
let initialized = false, expiry: ReturnType<typeof setTimeout> | undefined;
function stopCallListeners() {
  callVersion++; stopCall?.(); stopSignals?.(); stopCall = undefined; stopSignals = undefined;
  clearTimeout(expiry); expiry = undefined;
}
function watchCall(next: string) {
  if (next === callId && (!next || (stopCall && stopSignals))) return;
  stopCallListeners(); callId = next;
  state.update({ call: null, signals: [] }); if (!next) return;
  const current = uid, version = callVersion, account = accountVersion;
  const services = getFirebaseServices();
  let failed = false;
  const isCurrent = () => !failed && version === callVersion && account === accountVersion && services.auth.currentUser?.uid === current;
  const fail = (error: Error) => {
    if (!isCurrent()) return;
    failed = true; stopCallListeners(); state.fail(error);
  };
  const unsubscribeCall = onSnapshot(doc(services.firestore, 'voiceCalls', next), (snapshot) => {
    if (!isCurrent()) return;
    if (!snapshot.exists()) { state.update({ call: null, signals: [] }); return; }
    const data = snapshot.data(); const other = data.participants.find((participant: string) => participant !== current);
    const value: VoiceCall = { id: next, conversationId: data.conversationId, callerId: data.callerId, calleeId: data.calleeId, status: data.status, createdAt: data.createdAt, acceptedAt: data.acceptedAt, connectedAt: data.connectedAt, endedAt: data.endedAt, reason: data.reason, peer: data.peers[other] };
    state.update({ ...state.current(), call: value }); clearTimeout(expiry);
    if (['ringing', 'accepted'].includes(data.status)) {
      const deadline = data.status === 'ringing' ? data.createdAt + 40050 : Math.min(...(Object.values(data.heartbeat) as number[])) + 45050;
      expiry = setTimeout(() => {
        if (isCurrent()) void cloudBackendRequest(`/calls/${next}/expire`, {}).catch((error) => { if (isCurrent()) fail(error); });
      }, Math.max(100, deadline - Date.now()));
    }
  }, fail);
  if (isCurrent()) stopCall = unsubscribeCall; else { unsubscribeCall(); return; }
  const unsubscribeSignals = onSnapshot(query(collection(services.firestore, 'voiceCalls', next, 'signals'), where('toUid', '==', current)), (snapshot) => {
    if (!isCurrent()) return;
    const signals = snapshot.docs.map((entry) => entry.data() as VoiceSignal).sort((a, b) => a.seq - b.seq); state.update({ ...state.current(), signals });
  }, fail);
  if (isCurrent()) stopSignals = unsubscribeSignals; else unsubscribeSignals();
}
function ensure(requested: string) {
  const services = getFirebaseServices();
  if (!initialized) {
    initialized = true;
    onAuthStateChanged(services.auth, (user) => {
      if (user?.uid !== uid) {
        accountVersion++; stopState?.(); stopState = undefined; stopCallListeners(); callId = ''; uid = ''; state.reset();
      }
    });
  }
  const current = requireFirebaseUser().uid;
  if (current !== uid || !stopState) {
    accountVersion++; stopState?.(); stopState = undefined; stopCallListeners(); callId = ''; uid = current; state.reset();
    const version = accountVersion;
    let failed = false;
    const isCurrent = () => !failed && version === accountVersion && services.auth.currentUser?.uid === current;
    const unsubscribe = onSnapshot(doc(services.firestore, 'callState', current), (snapshot) => {
      if (!isCurrent()) return;
      const next = snapshot.data()?.callId;
      if (next) watchCall(next); else if (!callId) state.update({ call: null, signals: [] });
    }, (error) => {
      if (!isCurrent()) return;
      failed = true; stopState = undefined; stopCallListeners(); state.fail(error);
    });
    if (isCurrent()) stopState = unsubscribe; else unsubscribe();
  }
  if (callId && (!stopCall || !stopSignals)) watchCall(callId);
  else if (requested && !callId) watchCall(requested);
}
export const firebaseVoiceRepository: VoiceRepository = {
  async sync(cursor, requested, after, signal) { ensure(requested); const result = await state.wait(cursor, signal); return { cursor: result.cursor, call: result.value.call, signals: result.value.signals.filter((entry) => entry.seq > after) }; },
  ice: async () => (await cloudBackendRequest<{ iceServers: IceServer[] }>('/calls/ice')).iceServers,
  start: async (conversationId, clientId) => (await cloudBackendRequest<{ call: VoiceCall }>('/calls', { conversationId, clientId })).call,
  action: async (id, action, reason) => (await cloudBackendRequest<{ call: VoiceCall }>(`/calls/${id}/${action}`, { reason })).call,
  signal: async (id, type, payload, clientId) => { await cloudBackendRequest(`/calls/${id}/signals`, { type, payload, clientId }); },
};
