import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { getFirebaseServices } from '@/services/firebase';
import { requireFirebaseUser } from '@/services/firebase_identity';
import { createLiveSync } from '@/services/live_sync';
import { cloudBackendRequest } from '@/services/supabase';
import type { IceServer, VoiceCall, VoiceRepository, VoiceSignal } from '../domain/voice_call';

const state = createLiveSync<{ call: VoiceCall | null; signals: VoiceSignal[] }>({ call: null, signals: [] });
let uid = ''; let callId = ''; let stopState: (() => void) | undefined; let stopCall: (() => void) | undefined; let stopSignals: (() => void) | undefined; let initialized = false; let expiry: ReturnType<typeof setTimeout> | undefined;
function watchCall(next: string) {
  if (next === callId) return; stopCall?.(); stopSignals?.(); if (expiry) clearTimeout(expiry); callId = next;
  state.update({ call: null, signals: [] }); if (!next) return;
  const current = uid; const { firestore } = getFirebaseServices();
  stopCall = onSnapshot(doc(firestore, 'voiceCalls', next), (snapshot) => {
    if (!snapshot.exists()) { state.update({ call: null, signals: [] }); return; }
    const data = snapshot.data(); const other = data.participants.find((participant: string) => participant !== current);
    const value: VoiceCall = { id: next, conversationId: data.conversationId, callerId: data.callerId, calleeId: data.calleeId, status: data.status, createdAt: data.createdAt, acceptedAt: data.acceptedAt, connectedAt: data.connectedAt, endedAt: data.endedAt, reason: data.reason, peer: data.peers[other] };
    state.update({ ...state.current(), call: value }); if (expiry) clearTimeout(expiry);
    if (['ringing', 'accepted'].includes(data.status)) {
      const deadline = data.status === 'ringing' ? data.createdAt + 40050 : Math.min(...(Object.values(data.heartbeat) as number[])) + 45050;
      expiry = setTimeout(() => { cloudBackendRequest(`/calls/${next}/expire`, {}).catch((error) => state.fail(error)); }, Math.max(100, deadline - Date.now()));
    }
  }, (error) => state.fail(error));
  stopSignals = onSnapshot(query(collection(firestore, 'voiceCalls', next, 'signals'), where('toUid', '==', current)), (snapshot) => {
    const signals = snapshot.docs.map((entry) => entry.data() as VoiceSignal).sort((a, b) => a.seq - b.seq); state.update({ ...state.current(), signals });
  }, (error) => state.fail(error));
}
function ensure(requested: string) {
  const services = getFirebaseServices();
  if (!initialized) { initialized = true; onAuthStateChanged(services.auth, (user) => { if (user?.uid !== uid) { stopState?.(); stopState = undefined; watchCall(''); uid = ''; state.reset(); } }); }
  const current = requireFirebaseUser().uid;
  if (current !== uid || !stopState) {
    stopState?.(); watchCall(''); uid = current; state.reset();
    stopState = onSnapshot(doc(services.firestore, 'callState', current), (snapshot) => { const next = snapshot.data()?.callId; if (next) watchCall(next); else if (!callId) state.update({ call: null, signals: [] }); }, (error) => state.fail(error));
  }
  if (requested && !callId) watchCall(requested);
}
export const firebaseVoiceRepository: VoiceRepository = {
  async sync(cursor, requested, after, signal) { ensure(requested); const result = await state.wait(cursor, signal); return { cursor: result.cursor, call: result.value.call, signals: result.value.signals.filter((entry) => entry.seq > after) }; },
  ice: async () => (await cloudBackendRequest<{ iceServers: IceServer[] }>('/calls/ice')).iceServers,
  start: async (conversationId, clientId) => (await cloudBackendRequest<{ call: VoiceCall }>('/calls', { conversationId, clientId })).call,
  action: async (id, action, reason) => (await cloudBackendRequest<{ call: VoiceCall }>(`/calls/${id}/${action}`, { reason })).call,
  signal: async (id, type, payload, clientId) => { await cloudBackendRequest(`/calls/${id}/signals`, { type, payload, clientId }); },
};
