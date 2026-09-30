import { Redirect, router } from 'expo-router';

import { RegisterScreen } from '@/features/auth/presentation/register_screen';
import { useAccount } from '@/features/profile/profile_store';

export default function RegisterRoute() {
  const account = useAccount();
  if (account.signedIn) return <Redirect href="/home" />;
  return <RegisterScreen onBackToLogin={() => router.dismissTo('/login')} />;
}
