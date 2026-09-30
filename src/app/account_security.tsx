import { AccountSecurityScreen } from '@/features/profile/presentation/account_security_screen';
import { backOrReplace } from '@/navigation/app_navigation';

export default function AccountSecurityRoute() {
  return <AccountSecurityScreen onBack={() => backOrReplace('/profile')} />;
}
