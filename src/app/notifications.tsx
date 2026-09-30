import { router } from 'expo-router';

import type { AppNotification } from '@/features/notifications/notification_store';
import { NotificationsScreen } from '@/features/notifications/presentation/notifications_screen';
import { checkoutService } from '@/features/orders/orders_dependencies';
import { messageService } from '@/features/messages/messages_dependencies';
import { sellerListingsService } from '@/features/marketplace/marketplace_dependencies';
import { createListingParams } from '@/features/marketplace/presentation/listing_route_params';
import { useAccount } from '@/features/profile/profile_store';
import { backOrReplace } from '@/navigation/app_navigation';

export default function NotificationsRoute() {
  const account = useAccount();
  function openNotification(notification: AppNotification) {
    if (notification.destination === 'messages') {
      const conversationId = notification.conversationId ?? (notification.id === 'message-1' ? 'juan-brahman' : undefined);
      if (conversationId && messageService.get(conversationId)) {
        router.push({ pathname: '/messages/[id]', params: { id: conversationId } });
      } else router.push({ pathname: '/messages', params: { side: notification.side ?? (notification.category === 'listing' ? 'selling' : 'buying') } });
    } else if (notification.destination === 'profile') {
      router.push(account.signedIn ? '/profile' : '/login');
    } else if (notification.destination === 'order') {
      if (notification.orderId && checkoutService.getOrder(notification.orderId)) {
        router.push({ pathname: '/order_status', params: { orderId: notification.orderId } });
      } else router.push('/my_orders');
    } else {
      const draftId = notification.draftId ?? (notification.id === 'listing-2' ? 'ANM-L-0181' : undefined);
      const draft = sellerListingsService.getSnapshot().find((entry) => entry.id === draftId && entry.status === 'draft');
      if (draft) router.push({ pathname: '/listings/create', params: createListingParams(draft, true) });
      else router.push(account.signedIn ? '/my_listings' : '/login');
    }
  }

  return <NotificationsScreen onBack={() => backOrReplace('/home')} onOpenNotification={openNotification} />;
}
