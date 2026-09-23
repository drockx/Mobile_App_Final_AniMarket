import { router } from 'expo-router';

import { LoginScreen } from '@/features/auth/presentation/LoginScreen';

export default function LoginRoute() {
  return <LoginScreen onSignup={() => router.push('/register')} onLogin={() => router.replace('/home')} />;
}
