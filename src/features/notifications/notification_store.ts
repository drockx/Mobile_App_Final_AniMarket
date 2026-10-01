import { appRepositories } from '@/data/app_repositories';
import { getAccountSnapshot, subscribeAccount } from '../profile/profile_store';
import { messageService } from '../messages/messages_dependencies';
import { checkoutService } from '../orders/orders_dependencies';
import { orderStatusCopy } from '../orders/domain/order_status';
import { createNotificationStore } from './application/notification_service';

export type NotificationCategory = 'order' | 'message' | 'listing' | 'system';
export type NotificationDestination = 'messages' | 'profile' | 'order' | 'draft';
export type AppNotification = {
  id: string; category: NotificationCategory; section: 'today' | 'earlier'; title: string; description: string;
  meta: string; action: string; destination: NotificationDestination; orderId?: string; conversationId?: string;
  side?: 'buying' | 'selling'; draftId?: string; unread: boolean;
  icon: 'message' | 'order' | 'listing' | 'delivery' | 'bell' | 'complete' | 'rating';
};
export type NotificationRead = { id: string; ownerId: string; eventId: string };

export { createNotificationStore } from './application/notification_service';

export const notificationStore = createNotificationStore(appRepositories.notificationReads);
function refreshEvents() {
  const account = getAccountSnapshot();
  notificationStore.connectOwner(account.signedIn ? account.userId : '');
  if (!account.signedIn) return;
  const today = new Date().toLocaleDateString();
  const events: AppNotification[] = [];
  // Every destination is supplied by the real record, never by a fixture ID.
  const conversations = messageService.getUserId() === account.userId ? messageService.getSnapshot().conversations : [];
  for (const conversation of conversations) {
    if (!conversation.unreadCount) continue;
    events.push({ id: `message:${conversation.id}:${conversation.lastMessageSeq ?? conversation.updatedAt ?? ''}`,
      category: 'message', section: 'today', title: `Message from ${conversation.participant}`, description: conversation.preview,
      meta: conversation.time, action: 'Open', destination: 'messages', conversationId: conversation.id,
      side: conversation.side, unread: true, icon: 'message' });
  }
  for (const order of checkoutService.getSnapshot()) {
    if (order.ownerId !== account.userId) continue;
    events.push({ id: `order:${order.id}:${order.status}`, category: 'order',
      section: new Date(order.createdAt).toLocaleDateString() === today ? 'today' : 'earlier',
      title: orderStatusCopy(order).title,
      description: order.draft.item.title, meta: order.id, action: 'View', destination: 'order', orderId: order.id, unread: true, icon: 'order' });
  }
  notificationStore.replaceEvents(events);
}
subscribeAccount(refreshEvents); messageService.subscribe(refreshEvents); checkoutService.subscribe(refreshEvents); refreshEvents();
