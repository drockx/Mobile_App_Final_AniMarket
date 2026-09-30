import { router, useLocalSearchParams } from 'expo-router';

import { useOrders } from '@/features/orders/orders_store';
import { OrderPlacedScreen } from '@/features/orders/presentation/order_placed_screen';

export default function OrderPlacedRoute() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const orders = useOrders();
  const order = orders.find((entry) => entry.id === orderId);
  return <OrderPlacedScreen order={order}
    onOrders={() => router.dismissTo('/my_orders')}
    onStatus={() => { if (order) router.replace({ pathname: '/order_status', params: { orderId: order.id } }); }}
    onMarketplace={() => router.dismissTo('/home')}
  />;
}
