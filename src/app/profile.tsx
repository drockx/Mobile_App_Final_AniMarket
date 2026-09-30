import { router } from 'expo-router';

import { ProfileScreen } from '@/features/profile/presentation/profile_screen';
import { signOut } from '@/features/profile/profile_store';

export default function ProfileRoute() {
  return (
    <ProfileScreen
      onMessages={() => router.navigate('/messages')}
      onMarketReference={() => router.navigate('/market_reference')}
      onPriceCalculator={() => router.push('/price_calculator')}
      onPersonalInformation={() => router.push('/personal_information')}
      onAccountSecurity={() => router.push('/account_security')}
      onLogOut={() => { signOut(); router.replace('/login'); }}
    />
  );
}
