import { router, useLocalSearchParams } from 'expo-router';
import { sellerPhoneAction } from '@/components/seller_contact';

import { messageService } from '@/features/messages/messages_dependencies';
import { marketplaceService } from '@/features/marketplace/marketplace_dependencies';
import { checkoutService, getOrderStatus } from '@/features/orders/orders_dependencies';
import { OrderStatusScreen } from '@/features/orders/presentation/order_status_screen';
import { useOrderState } from '@/features/orders/orders_store';

export default function OrderStatusRoute() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const data = useOrderState();
  const { request, example } = orderId
    ? { request: data.items.find((entry) => entry.id === orderId), example: false }
    : getOrderStatus();
  const item = request?.draft.item;
  return <OrderStatusScreen
    key={request?.id ?? orderId ?? 'missing'} order={request} example={example}
    loading={data.loading} error={data.error} onRetry={checkoutService.retry}
    onCall={sellerPhoneAction(item?.sellerPhone)}
    onBack={() => router.dismissTo('/my_orders')}
    onMarketplace={() => router.dismissTo('/home')}
    onViewListing={!item || !marketplaceService.getListing(item.id) ? undefined : () => router.push({ pathname: '/listings/id', params: { id: item.id } })}
    onMessage={item && item.seller !== 'Seller to confirm' ? () => {
      const sellerId = item.sellerId ?? marketplaceService.getListing(item.id)?.seller?.id;
      if (!sellerId) { router.push({ pathname: '/messages', params: { notice: 'sample-seller' } }); return; }
      void messageService.openBuyerConversation({ ...item, sellerId }).then((conversation) => {
        router.push({ pathname: '/messages/[id]', params: { id: conversation.id } });
      }).catch(() => router.push({ pathname: '/messages', params: { notice: 'chat-error' } }));
    } : undefined}
    onCancel={(id) => checkoutService.cancelRequest(id)}
  />;
}
