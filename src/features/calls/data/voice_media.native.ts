import { isRunningInExpoGo } from 'expo';
import { NativeModules } from 'react-native';
import type { IceServer, VoiceCandidate, VoiceMedia } from '../domain/voice_call';

// Load native modules only when a call is requested so Expo Go can still open the app.
export function createVoiceMedia(): VoiceMedia {
  if (isRunningInExpoGo()) throw new Error('Voice calls need the AniMarket development build. Expo Go does not include the call module.');
  if (!NativeModules.WebRTCModule || !NativeModules.InCallManager) throw new Error('Rebuild and install the AniMarket development app to enable voice calls. This build is missing the call modules.');
  type NativeRtc = typeof import('react-native-webrtc');
  let audio: typeof import('react-native-incall-manager').default | null = null;
  let peer: InstanceType<NativeRtc['RTCPeerConnection']> | null = null;
  let stream: InstanceType<NativeRtc['MediaStream']> | null = null; let closed = false;
  const current = () => { if (!peer || closed) throw new Error('The voice connection is unavailable.'); return peer; };
  return {
    supportsSpeaker: true,
    async prepare(iceServers: IceServer[], events) {
      const [rtc, audioModule] = await Promise.all([import('react-native-webrtc'), import('react-native-incall-manager')]);
      if (closed) throw new Error('Call cancelled.');
      audio = audioModule.default;
      const captured = await rtc.mediaDevices.getUserMedia({ audio: true, video: false });
      if (closed) { captured.getTracks().forEach((track) => track.stop()); captured.release(); throw new Error('Call cancelled.'); }
      stream = captured; audio.start({ media: 'audio' });
      peer = new rtc.RTCPeerConnection({ iceServers });
      peer.onicecandidate = (event: unknown) => {
        const candidate = (event as unknown as { candidate?: { toJSON(): VoiceCandidate } }).candidate;
        if (candidate && !closed) events.candidate(candidate.toJSON());
      };
      peer.onconnectionstatechange = () => { if (!closed && peer) events.connection(peer.connectionState); };
      captured.getTracks().forEach((track) => current().addTrack(track, captured));
    },
    async offer() { const value = await current().createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false }); await current().setLocalDescription(value); return { type: 'offer', sdp: value.sdp }; },
    async answer(value) { await current().setRemoteDescription(value); const answer = await current().createAnswer(); await current().setLocalDescription(answer); return { type: 'answer', sdp: answer.sdp }; },
    applyAnswer: (value) => current().setRemoteDescription(value),
    addCandidate: (value) => current().addIceCandidate(value),
    mute(value) { stream?.getAudioTracks().forEach((track) => { track.enabled = !value; }); },
    speaker(value) { audio?.setForceSpeakerphoneOn(value); },
    close() {
      closed = true; peer?.close(); peer = null;
      stream?.getTracks().forEach((track) => track.stop()); stream?.release(); stream = null;
      audio?.stop();
    },
  };
}
