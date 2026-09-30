import { router } from 'expo-router';

import { sellerListingsService } from '@/features/marketplace/marketplace_dependencies';
import { MyListingsScreen } from '@/features/marketplace/presentation/my_listings_screen';
import { createListingParams } from '@/features/marketplace/presentation/listing_route_params';
import { backOrReplace } from '@/navigation/app_navigation';

export default function MyListingsRoute() {
  return (
    <MyListingsScreen
      service={sellerListingsService}
      onBack={() => backOrReplace('/profile')}
      onCreate={(listing, continueDraft) => router.push({ pathname: '/listings/create', params: createListingParams(listing, continueDraft) })}
      onInquiries={() => router.dismissTo({ pathname: '/messages', params: { side: 'selling' } })}
      onOrders={() => router.push('/my_orders')}
    />
  );
}
