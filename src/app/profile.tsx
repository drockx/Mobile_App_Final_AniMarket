import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { ProfileScreen } from '@/features/profile/presentation/profile_screen';
import { signOut } from '@/features/profile/profile_store';
import { sellerListingsService } from '@/features/marketplace/marketplace_dependencies';

export default function ProfileRoute() {
  const listings = useSyncExternalStore(sellerListingsService.subscribe, sellerListingsService.getSnapshot, sellerListingsService.getSnapshot);
  return (
    <ProfileScreen
      activeListingCount={listings.filter((listing) => listing.status === 'active').length}
      onMyListings={() => router.push('/my_listings')}
      onMessages={() => router.navigate('/messages')}
      onMarketReference={() => router.navigate('/market_reference')}
      onPriceCalculator={() => router.push('/price_calculator')}
      onPersonalInformation={() => router.push('/personal_information')}
      onAccountSecurity={() => router.push('/account_security')}
      onLogOut={() => { signOut(); router.replace('/login'); }}
    />
  );
}
