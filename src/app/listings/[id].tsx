import { useLocalSearchParams } from 'expo-router';

import { ListingDetailsScreen } from '@/features/marketplace/presentation/ListingDetailsScreen';

export default function ListingDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ListingDetailsScreen listingId={id} />;
}
