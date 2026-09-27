import { router } from 'expo-router';

import { marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { CreateListingScreen } from '@/features/marketplace/presentation/create_listing_screen';

export default function CreateListingRoute() {
  return (
    <CreateListingScreen
      marketplace={marketplaceService}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/home');
      }}
      onPublished={(id) => router.replace({ pathname: '/listings/id', params: { id } })}
      onMarketReference={() => router.push('/market_reference')}
    />
  );
}
