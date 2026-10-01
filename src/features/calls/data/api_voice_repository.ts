import { apiRequest } from '@/services/api';
import type { IceServer, VoiceCall, VoiceRepository } from '../domain/voice_call';

export const apiVoiceRepository: VoiceRepository = {
  sync: (cursor, callId, after, signal) => {
    const params = new URLSearchParams({ callId, after: String(after) });
    if (cursor !== null) params.set('cursor', String(cursor));
    return apiRequest(`/calls/sync?${params}`, { signal, timeout: 32000 });
  },
  ice: async () => (await apiRequest<{ iceServers: IceServer[] }>('/calls/ice')).iceServers,
  start: async (conversationId, clientId) => (await apiRequest<{ call: VoiceCall }>('/calls', { method: 'POST', body: { conversationId, clientId } })).call,
  action: async (id, action, reason) => (await apiRequest<{ call: VoiceCall }>(`/calls/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: { reason } })).call,
  signal: async (id, type, payload, clientId) => { await apiRequest(`/calls/${encodeURIComponent(id)}/signals`, { method: 'POST', body: { type, payload, clientId } }); },
};
