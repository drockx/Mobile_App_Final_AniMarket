import { router, useLocalSearchParams } from 'expo-router';

import { messageService } from '@/features/messages/messages_dependencies';
import { marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { checkoutService, getOrderStatus } from '@/features/orders/orders_dependencies';
import { OrderStatusScreen } from '@/features/orders/presentation/order_status_screen';
import { useOrders } from '@/features/orders/orders_store';

export default function OrderStatusRoute() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const orders = useOrders();
  const { request, example } = orderId
    ? { request: orders.find((entry) => entry.id === orderId), example: false }
    : getOrderStatus();
  const item = request?.draft.item;
  return <OrderStatusScreen
    key={request?.id ?? orderId ?? 'missing'} order={request} example={example}
    onBack={() => router.dismissTo('/my_orders')}
    onMarketplace={() => router.dismissTo('/home')}
    onViewListing={!item || !marketplaceService.getListing(item.id) ? undefined : () => router.push({ pathname: '/listings/id', params: { id: item.id } })}
    onMessage={item && item.seller !== 'Seller to confirm' ? () => {
      const conversation = messageService.openBuyerConversation(item);
      router.push({ pathname: '/messages/[id]', params: { id: conversation.id } });
    } : undefined}
    onCancel={(id) => example && request
      ? { request: { ...request, status: 'cancelled', cancelledAt: new Date().toISOString() }, error: null }
      : checkoutService.cancelRequest(id)}
  />;
}
