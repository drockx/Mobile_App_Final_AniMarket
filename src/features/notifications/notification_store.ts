export type NotificationCategory = 'order' | 'message' | 'listing' | 'system';
export type NotificationDestination = 'messages' | 'profile' | 'order' | 'draft';

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  section: 'today' | 'earlier';
  title: string;
  description: string;
  meta: string;
  action: string;
  destination: NotificationDestination;
  orderId?: string;
  conversationId?: string;
  side?: 'buying' | 'selling';
  draftId?: string;
  unread: boolean;
  icon: 'message' | 'order' | 'listing' | 'delivery' | 'bell' | 'complete' | 'rating';
};

// Reference content for the screen until notifications are supplied by an app service.
let notifications: readonly AppNotification[] = [
  { id: 'message-1', category: 'message', section: 'today', title: 'New message from Juan Dela Cruz', description: '“Yes, the Brahman bull is still available. Are you ready to order?”', meta: '10:24 AM · Brahman Bull listing', action: 'Open', destination: 'messages', unread: true, icon: 'message' },
  { id: 'order-1', category: 'order', section: 'today', title: 'Seller accepted your order', description: 'Order ANM-2026-184205 is confirmed. Review the delivery arrangement.', meta: '9:48 AM · Buying order', action: 'View', destination: 'order', unread: true, icon: 'order' },
  { id: 'listing-1', category: 'listing', section: 'today', title: 'Your listing received 3 inquiries', description: 'Buyers are asking about the Brahman bull’s price and delivery availability.', meta: '8:35 AM · Listing ANM-L-0148', action: 'Reply', destination: 'messages', unread: true, icon: 'listing' },
  { id: 'order-2', category: 'order', section: 'today', title: 'Delivery schedule requires confirmation', description: 'Confirm the Sep 25 delivery date with Davao Livestock Transport Cooperative.', meta: '7:50 AM · Order ANM-2026-184205', action: 'Confirm', destination: 'order', unread: true, icon: 'delivery' },
  { id: 'system-1', category: 'system', section: 'today', title: 'Complete your account verification', description: 'Add a valid ID to improve buyer trust and listing visibility.', meta: '7:15 AM · Account', action: 'Review', destination: 'profile', unread: true, icon: 'bell' },
  { id: 'order-3', category: 'order', section: 'earlier', title: 'Pickup completed', description: 'Your Native Goat order was marked as received.', meta: 'Yesterday · Order ANM-2026-170944', action: 'View', destination: 'order', unread: false, icon: 'complete' },
  { id: 'listing-2', category: 'listing', section: 'earlier', title: 'Draft listing needs vaccination proof', description: 'Add proof before publishing the Landrace Market Hogs listing.', meta: 'Yesterday · Draft ANM-L-0181', action: 'Edit', destination: 'draft', unread: false, icon: 'listing' },
  { id: 'system-2', category: 'system', section: 'earlier', title: 'You received a 5-star rating', description: 'GreenPasture Farm rated your completed transaction.', meta: 'Sep 19 · Seller rating', action: 'View', destination: 'profile', unread: false, icon: 'rating' },
];

const listeners = new Set<() => void>();

function publish(next: readonly AppNotification[]) {
  notifications = next;
  listeners.forEach((listener) => listener());
}

export const notificationStore = {
  getSnapshot: () => notifications,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  markRead: (id: string) => {
    if (notifications.some((item) => item.id === id && item.unread)) {
      publish(notifications.map((item) => item.id === id ? { ...item, unread: false } : item));
    }
  },
  markAllRead: () => {
    if (notifications.some((item) => item.unread)) {
      publish(notifications.map((item) => ({ ...item, unread: false })));
    }
  },
};
