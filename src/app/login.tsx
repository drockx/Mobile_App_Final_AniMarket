import { router } from 'expo-router';

import { LoginScreen } from '@/features/auth/presentation/login_screen';

export default function LoginRoute() {
  return <LoginScreen onSignup={() => router.push('/register')} onLogin={() => router.replace('/home')} />;
}
