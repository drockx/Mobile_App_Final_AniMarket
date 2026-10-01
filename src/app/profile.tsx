import { router, useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

import { ProfileScreen } from '@/features/profile/presentation/profile_screen';
import { refreshAccount, signOut } from '@/features/profile/profile_store';
import { sellerListingsService } from '@/features/marketplace/marketplace_dependencies';
import { useOrders } from '@/features/orders/orders_store';
import { messageService } from '@/features/messages/messages_dependencies';

export default function ProfileRoute() {
  useFocusEffect(useCallback(() => { void refreshAccount().catch(() => {}); }, []));
  const orders = useOrders();
  const messages = useSyncExternalStore(messageService.subscribe, messageService.getSnapshot, messageService.getSnapshot);
  const listings = useSyncExternalStore(sellerListingsService.subscribe, sellerListingsService.getSnapshot, sellerListingsService.getSnapshot);
  return (
    <ProfileScreen
      activeListingCount={listings.filter((listing) => listing.status === 'active').length}
      orderCount={orders.length}
      unreadMessageCount={messages.conversations.reduce((count, item) => count + item.unreadCount, 0)}
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
