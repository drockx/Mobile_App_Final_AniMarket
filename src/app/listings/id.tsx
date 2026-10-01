import { router, useLocalSearchParams } from 'expo-router';

import { ListingDetailsScreen } from '@/features/marketplace/presentation/listing_details_screen';
import { marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { messageService } from '@/features/messages/messages_dependencies';
import { backOrReplace } from '@/navigation/app_navigation';
import { useAccount } from '@/features/profile/profile_store';

export default function ListingDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = marketplaceService.getListing(id);
  const account = useAccount();
  return (
    <ListingDetailsScreen
      listingId={id}
      marketplace={marketplaceService}
      onOrder={(listingId) => router.push({ pathname: '/order_checkout', params: { id: listingId } })}
      onChat={listing?.seller ? () => {
        if (!account.signedIn) { router.push({ pathname: '/login', params: { returnTo: '/messages' } }); return; }
        if (!listing.seller?.id) { router.push({ pathname: '/messages', params: { notice: 'sample-seller' } }); return; }
        void messageService.openBuyerConversation({ id: listing.id, title: listing.title, seller: listing.seller.name, sellerId: listing.seller.id }).then((conversation) => {
          router.push({ pathname: '/messages/[id]', params: { id: conversation.id } });
        }).catch(() => router.push({ pathname: '/messages', params: { notice: 'chat-error' } }));
      } : undefined}
      onBack={() => backOrReplace('/home')}
    />
  );
}
