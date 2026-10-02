import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { RegisterScreen } from '@/features/auth/presentation/register_screen';
import { registerAccount, useAccount } from '@/features/profile/profile_store';
import { loginDestination } from '@/navigation/login_destination';

export default function RegisterRoute() {
  const account = useAccount();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  if (account.signedIn) return <Redirect href={loginDestination(returnTo, account.isStaff)} />;
  return <RegisterScreen onRegister={registerAccount} onBackToLogin={() => router.dismissTo({ pathname: '/login', params: { returnTo } })} />;
}
