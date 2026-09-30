import { router } from 'expo-router';

import { useOrders } from '@/features/orders/orders_store';
import { MyOrdersScreen } from '@/features/orders/presentation/my_orders_screen';
import { useAccount } from '@/features/profile/profile_store';
import { backOrReplace } from '@/navigation/app_navigation';

export default function MyOrdersRoute() {
  const orders = useOrders();
  const account = useAccount();
  return <MyOrdersScreen orders={orders}
    onBack={() => backOrReplace(account.signedIn ? '/profile' : '/home')}
    onOpenOrder={(orderId) => router.push({ pathname: '/order_status', params: { orderId } })}
    onMarketplace={() => router.dismissTo('/home')}
  />;
}
