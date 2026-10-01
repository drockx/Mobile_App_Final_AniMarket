import { router } from 'expo-router';
import { AccountVerificationScreen } from '@/features/profile/presentation/account_verification_screen';
import { backOrReplace } from '@/navigation/app_navigation';

export default function AccountVerificationRoute() {
  return <AccountVerificationScreen onBack={() => backOrReplace('/profile')} onPersonalInformation={() => router.push('/personal_information')} />;
}
