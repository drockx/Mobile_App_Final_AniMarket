export type VoiceCall = {
  id: string; conversationId: string; callerId: string; calleeId: string;
  status: 'ringing' | 'accepted' | 'ended' | 'declined' | 'missed';
  createdAt: number; acceptedAt: number | null; connectedAt: number | null; endedAt: number | null; reason: string | null;
  peer: { id: string; name: string; initials: string; city: string; verified: boolean };
};
export type VoiceDescription = { type: 'offer' | 'answer'; sdp: string };
export type VoiceCandidate = { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
export type VoiceSignal = { seq: number; type: 'offer' | 'answer' | 'ice'; payload: VoiceDescription | VoiceCandidate };
export type IceServer = { urls: string | string[]; username?: string; credential?: string };
export type VoiceRepository = {
  sync(cursor: number | null, callId: string, after: number, signal: AbortSignal): Promise<{ cursor: number; call: VoiceCall | null; signals: VoiceSignal[] }>;
  ice(): Promise<IceServer[]>;
  start(conversationId: string, clientId: string): Promise<VoiceCall>;
  action(id: string, action: 'accept' | 'decline' | 'end' | 'heartbeat' | 'connected', reason?: string): Promise<VoiceCall>;
  signal(id: string, type: VoiceSignal['type'], payload: VoiceSignal['payload'], clientId: string): Promise<void>;
};
export type VoiceMedia = {
  supportsSpeaker: boolean;
  prepare(servers: IceServer[], events: { candidate(value: VoiceCandidate): void; connection(state: string): void }): Promise<void>;
  offer(): Promise<VoiceDescription>;
  answer(offer: VoiceDescription): Promise<VoiceDescription>;
  applyAnswer(answer: VoiceDescription): Promise<void>;
  addCandidate(candidate: VoiceCandidate): Promise<void>;
  mute(value: boolean): void;
  speaker(value: boolean): void;
  close(): void;
};
export const isActiveCall = (call: VoiceCall | null) => !!call && (call.status === 'ringing' || call.status === 'accepted');
export function callDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
