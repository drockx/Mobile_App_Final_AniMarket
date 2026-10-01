import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { LoginScreen } from '@/features/auth/presentation/login_screen';
import { signIn, useAccount } from '@/features/profile/profile_store';
import { loginDestination } from '@/navigation/login_destination';

export default function LoginRoute() {
  const account = useAccount();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  if (account.signedIn) return <Redirect href={loginDestination(returnTo)} />;
  return <LoginScreen onSignup={() => router.push({ pathname: '/register', params: { returnTo } })} onLogin={signIn} />;
}
