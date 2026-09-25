import { router, useLocalSearchParams } from 'expo-router';

import { ListingDetailsScreen } from '@/features/marketplace/presentation/listing_details_screen';
import { marketplaceService } from '@/features/marketplace/marketplace_dependencies';

export default function ListingDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ListingDetailsScreen
      listingId={id}
      marketplace={marketplaceService}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/home');
      }}
    />
  );
}
