import { router, useLocalSearchParams } from 'expo-router';

import { useOrderState } from '@/features/orders/orders_store';
import { checkoutService } from '@/features/orders/orders_dependencies';
import { OrderPlacedScreen } from '@/features/orders/presentation/order_placed_screen';

export default function OrderPlacedRoute() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const data = useOrderState();
  const order = data.items.find((entry) => entry.id === orderId);
  return <OrderPlacedScreen order={order}
    loading={data.loading} error={data.error} onRetry={checkoutService.retry}
    onOrders={() => router.dismissTo('/my_orders')}
    onStatus={() => { if (order) router.replace({ pathname: '/order_status', params: { orderId: order.id } }); }}
    onMarketplace={() => router.dismissTo('/home')}
  />;
}
