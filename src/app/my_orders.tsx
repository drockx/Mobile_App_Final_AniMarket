import { router } from 'expo-router';

import { useOrderState } from '@/features/orders/orders_store';
import { checkoutService } from '@/features/orders/orders_dependencies';
import { MyOrdersScreen } from '@/features/orders/presentation/my_orders_screen';
import { useAccount } from '@/features/profile/profile_store';
import { backOrReplace } from '@/navigation/app_navigation';

export default function MyOrdersRoute() {
  const data = useOrderState();
  const account = useAccount();
  return <MyOrdersScreen orders={data.items} loading={data.loading} error={data.error} onRetry={checkoutService.retry}
    onBack={() => backOrReplace(account.signedIn ? '/profile' : '/home')}
    onOpenOrder={(orderId) => router.push({ pathname: '/order_status', params: { orderId } })}
    onMarketplace={() => router.dismissTo('/home')}
  />;
}
