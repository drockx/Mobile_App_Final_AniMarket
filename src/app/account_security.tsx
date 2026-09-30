import { router } from 'expo-router';

import { AccountSecurityScreen } from '@/features/profile/presentation/account_security_screen';

export default function AccountSecurityRoute() {
  return <AccountSecurityScreen onBack={() => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  }} />;
}
