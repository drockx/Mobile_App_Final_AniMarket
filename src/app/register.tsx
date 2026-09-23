import { router } from 'expo-router';

import { RegisterScreen } from '@/features/auth/presentation/RegisterScreen';

export default function RegisterRoute() {
  return <RegisterScreen onBackToLogin={() => router.replace('/login')} />;
}
