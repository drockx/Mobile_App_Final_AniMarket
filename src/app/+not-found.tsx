import { router } from 'expo-router';
import { RecoveryScreen } from '@/components/recovery_screen';

export default function NotFoundRoute() {
  return <RecoveryScreen title="Page unavailable" message="This link may be incomplete or no longer available. Return to the marketplace to continue." action="Back to Marketplace" onAction={() => router.replace('/home')} />;
}
