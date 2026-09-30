import { router, useLocalSearchParams } from 'expo-router';

import { checkoutService, getCheckoutItem } from '@/features/orders/orders_dependencies';
import { OrderCheckoutScreen } from '@/features/orders/presentation/order_checkout_screen';
import { useAccount } from '@/features/profile/profile_store';

export default function OrderCheckoutRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = useAccount();
  const item = getCheckoutItem(id);
  return <OrderCheckoutScreen
    key={item?.id ?? 'missing'} item={item} service={checkoutService}
    receiverName={account.personal.fullName} receiverPhone={account.personal.phone}
    onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/home'); }}
  />;
}
