import { router, useLocalSearchParams } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { sellerPhoneAction } from '@/components/seller_contact';

import { ListingDetailsScreen } from '@/features/marketplace/presentation/listing_details_screen';
import { marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { messageService } from '@/features/messages/messages_dependencies';
import { backOrReplace } from '@/navigation/app_navigation';
import { useAccount } from '@/features/profile/profile_store';

export default function ListingDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useSyncExternalStore(marketplaceService.subscribe, marketplaceService.getSnapshot, marketplaceService.getSnapshot);
  const listing = marketplaceService.getListing(id);
  const account = useAccount();
  return (
    <ListingDetailsScreen
      listingId={id}
      marketplace={marketplaceService}
      onCall={sellerPhoneAction(listing?.seller?.phone)}
      orderEnabled={!!listing?.seller?.id && listing.seller.id !== account.userId}
      orderNotice={listing?.seller?.id === account.userId ? 'This is your listing.' : !listing?.seller?.id ? 'Orders require a registered seller.' : undefined}
      onOrder={(listingId) => account.signedIn
        ? router.push({ pathname: '/order_checkout', params: { id: listingId } })
        : router.push({ pathname: '/login', params: { returnTo: `/order_checkout?id=${encodeURIComponent(listingId)}` } })}
      onChat={listing?.seller && listing.seller.id !== account.userId ? () => {
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
