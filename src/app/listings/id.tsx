import { router, useLocalSearchParams } from 'expo-router';

import { ListingDetailsScreen } from '@/features/marketplace/presentation/listing_details_screen';
import { marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { messageService } from '@/features/messages/messages_dependencies';
import { backOrReplace } from '@/navigation/app_navigation';

export default function ListingDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = marketplaceService.getListing(id);
  return (
    <ListingDetailsScreen
      listingId={id}
      marketplace={marketplaceService}
      onOrder={(listingId) => router.push({ pathname: '/order_checkout', params: { id: listingId } })}
      onChat={listing?.seller ? () => {
        const conversation = messageService.openBuyerConversation({ id: listing.id, title: listing.title, seller: listing.seller!.name, verified: listing.verified });
        router.push({ pathname: '/messages/[id]', params: { id: conversation.id } });
      } : undefined}
      onBack={() => backOrReplace('/home')}
    />
  );
}
