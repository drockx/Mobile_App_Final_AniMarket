import { router, useLocalSearchParams } from 'expo-router';

import { messageService } from '@/features/messages/messages_dependencies';
import { marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { checkoutService, getOrderStatus } from '@/features/orders/orders_dependencies';
import { OrderStatusScreen } from '@/features/orders/presentation/order_status_screen';

export default function OrderStatusRoute() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { request, example } = getOrderStatus(orderId);
  const item = request?.draft.item;
  const conversation = item && messageService.list('buying', '').find((entry) => entry.participant === item.seller && entry.listing === item.title);
  return <OrderStatusScreen
    key={request?.id ?? orderId ?? 'missing'} order={request} example={example}
    onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/home'); }}
    onMarketplace={() => router.navigate('/home')}
    onViewListing={!item || !marketplaceService.getListing(item.id) ? undefined : () => router.push({ pathname: '/listings/id', params: { id: item.id } })}
    onMessage={conversation ? () => router.push({ pathname: '/messages/[id]', params: { id: conversation.id } }) : undefined}
    onCancel={(id) => example && request
      ? { request: { ...request, status: 'cancelled', cancelledAt: new Date().toISOString() }, error: null }
      : checkoutService.cancelRequest(id)}
  />;
}
