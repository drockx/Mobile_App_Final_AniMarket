import { router } from 'expo-router';

import { ProfileScreen } from '@/features/profile/presentation/profile_screen';

export default function ProfileRoute() {
  return (
    <ProfileScreen
      onMessages={() => router.navigate('/messages')}
      onMarketReference={() => router.navigate('/market_reference')}
      onLogOut={() => router.replace('/login')}
    />
  );
}
