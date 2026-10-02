import { router, useLocalSearchParams } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import { voiceService } from '@/features/calls/calls_dependencies';

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
      onCall={listing?.seller?.id && listing.seller.id !== account.userId ? () => {
        if (!account.signedIn) { router.push({ pathname: '/login', params: { returnTo: '/messages' } }); return; }
        const current = voiceService.getSnapshot();
        if (current.busy || !['idle', 'ended', 'error'].includes(current.phase)) { router.push('/voice_call'); return; }
        void messageService.openConversation(listing.seller!.id!).then((conversation) => {
          void voiceService.start(conversation.id).catch(() => {});
          router.push('/voice_call');
        }).catch((error) => Alert.alert('Call unavailable', error instanceof Error ? error.message : 'This seller cannot be called right now.'));
      } : undefined}
      orderEnabled={!!listing?.seller?.id && listing.seller.id !== account.userId}
      orderNotice={listing?.seller?.id === account.userId ? 'This is your listing.' : !listing?.seller?.id ? 'Orders require a registered seller.' : undefined}
      onOrder={(listingId) => account.signedIn
        ? router.push({ pathname: '/order_checkout', params: { id: listingId } })
        : router.push({ pathname: '/login', params: { returnTo: `/order_checkout?id=${encodeURIComponent(listingId)}` } })}
      onChat={listing?.seller && listing.seller.id !== account.userId ? () => {
        if (!account.signedIn) { router.push({ pathname: '/login', params: { returnTo: '/messages' } }); return; }
        if (!listing.seller?.id) { router.push({ pathname: '/messages', params: { notice: 'seller-unavailable' } }); return; }
        void messageService.openBuyerConversation({ id: listing.id, title: listing.title, seller: listing.seller.name, sellerId: listing.seller.id }).then((conversation) => {
          router.push({ pathname: '/messages/[id]', params: { id: conversation.id } });
        }).catch(() => router.push({ pathname: '/messages', params: { notice: 'chat-error' } }));
      } : undefined}
      onBack={() => backOrReplace('/home')}
    />
  );
}
