import { Redirect, router } from 'expo-router';

import { LoginScreen } from '@/features/auth/presentation/login_screen';
import { signIn, useAccount } from '@/features/profile/profile_store';

export default function LoginRoute() {
  const account = useAccount();
  if (account.signedIn) return <Redirect href="/home" />;
  return <LoginScreen onSignup={() => router.push('/register')} onLogin={(username, password) => {
    const error = signIn(username, password);
    if (!error) { if (router.canDismiss()) router.dismissAll(); router.replace('/home'); }
    return error;
  }} />;
}
