import { router } from 'expo-router';
import { voiceService } from '@/features/calls/calls_dependencies';
import { VoiceCallScreen } from '@/features/calls/presentation/voice_call_screen';
import { backOrReplace } from '@/navigation/app_navigation';

export default function VoiceCallRoute() {
  return <VoiceCallScreen service={voiceService} onBack={() => backOrReplace('/messages')}
    onMessage={(id) => router.dismissTo({ pathname: '/messages/[id]', params: { id } })} />;
}
