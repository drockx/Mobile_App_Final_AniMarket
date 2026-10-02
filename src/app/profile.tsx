import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';

import { ProfileScreen } from '@/features/profile/presentation/profile_screen';
import { refreshAccount, signOut, useAccount } from '@/features/profile/profile_store';
import type { PublicProfile } from '@/features/profile/presentation/public_profile_screen';
import { apiRequest } from '@/services/api';
import { sellerListingsService } from '@/features/marketplace/marketplace_dependencies';
import { useOrders } from '@/features/orders/orders_store';
import { messageService } from '@/features/messages/messages_dependencies';

export default function ProfileRoute() {
  const account = useAccount();
  const [ratingAverage, setRatingAverage] = useState<number | null>(null);
  useFocusEffect(useCallback(() => {
    void refreshAccount().catch(() => {});
    const controller = new AbortController();
    setRatingAverage(null);
    if (account.userId) void apiRequest<{ profile: PublicProfile }>(`/users/${account.userId}`, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setRatingAverage(result.profile.rating.average);
    }).catch(() => {});
    return () => controller.abort();
  }, [account.userId]));
  const orders = useOrders();
  const messages = useSyncExternalStore(messageService.subscribe, messageService.getSnapshot, messageService.getSnapshot);
  const listings = useSyncExternalStore(sellerListingsService.subscribe, sellerListingsService.getSnapshot, sellerListingsService.getSnapshot);
  return (
    <ProfileScreen
      activeListingCount={listings.filter((listing) => listing.status === 'active').length}
      orderCount={orders.length}
      unreadMessageCount={messages.conversations.reduce((count, item) => count + item.unreadCount, 0)}
      ratingAverage={ratingAverage}
      onPublicProfile={() => router.push({ pathname: '/users/[id]', params: { id: account.userId } })}
      onMyListings={() => router.push('/my_listings')}
      onMyOrders={() => router.push('/my_orders')}
      onMessages={() => router.dismissTo('/messages')}
      onMarketReference={() => router.dismissTo('/market_reference')}
      onPriceCalculator={() => router.push('/price_calculator')}
      onPersonalInformation={() => router.push('/personal_information')}
      onAccountSecurity={() => router.push('/account_security')}
      onVerification={() => router.push('/account_verification')}
      onIdReviews={() => router.push('/verification_review')}
      onLogOut={() => { if (router.canDismiss()) router.dismissAll(); signOut(); router.replace('/login'); }}
    />
  );
}
