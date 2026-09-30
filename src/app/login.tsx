import { router } from 'expo-router';

import { LoginScreen } from '@/features/auth/presentation/login_screen';
import { signIn } from '@/features/profile/profile_store';

export default function LoginRoute() {
  return <LoginScreen onSignup={() => router.push('/register')} onLogin={(username, password) => {
    const error = signIn(username, password);
    if (!error) router.replace('/home');
    return error;
  }} />;
}
