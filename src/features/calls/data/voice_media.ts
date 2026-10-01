import type { IceServer, VoiceMedia } from '../domain/voice_call';

export function createVoiceMedia(): VoiceMedia {
  if (typeof window === 'undefined' || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    throw new Error('Voice calls need microphone access on HTTPS or localhost. Open the app over HTTPS and allow the microphone.');
  }
  let peer: RTCPeerConnection | null = null; let stream: MediaStream | null = null; let closed = false;
  const output = new Audio(); output.autoplay = true;
  const current = () => { if (!peer || closed) throw new Error('The voice connection is unavailable.'); return peer; };
  return {
    supportsSpeaker: false,
    async prepare(iceServers: IceServer[], events) {
      const captured = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (closed) { captured.getTracks().forEach((track) => track.stop()); throw new Error('Call cancelled.'); }
      stream = captured; peer = new RTCPeerConnection({ iceServers });
      peer.onicecandidate = (event) => { if (event.candidate && !closed) events.candidate({ candidate: event.candidate.candidate, sdpMid: event.candidate.sdpMid, sdpMLineIndex: event.candidate.sdpMLineIndex }); };
      peer.onconnectionstatechange = () => { if (!closed && peer) events.connection(peer.connectionState); };
      peer.ontrack = (event) => {
        output.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void output.play().catch(() => events.connection('failed'));
      };
      captured.getTracks().forEach((track) => current().addTrack(track, captured));
    },
    async offer() { const value = await current().createOffer(); await current().setLocalDescription(value); return { type: 'offer', sdp: value.sdp! }; },
    async answer(value) { await current().setRemoteDescription(value); const answer = await current().createAnswer(); await current().setLocalDescription(answer); return { type: 'answer', sdp: answer.sdp! }; },
    applyAnswer: (value) => current().setRemoteDescription(value),
    addCandidate: (value) => current().addIceCandidate(value),
    mute(value) { stream?.getAudioTracks().forEach((track) => { track.enabled = !value; }); },
    speaker() {},
    close() { closed = true; peer?.close(); peer = null; stream?.getTracks().forEach((track) => track.stop()); stream = null; output.pause(); output.srcObject = null; },
  };
}
