import { router, useLocalSearchParams } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { getOrderPickupPin, marketplaceService } from '@/features/marketplace/marketplace_dependencies';

import { checkoutService, getCheckoutItem } from '@/features/orders/orders_dependencies';
import { OrderCheckoutScreen } from '@/features/orders/presentation/order_checkout_screen';
import { BuyerVerificationRequiredScreen } from '@/features/orders/presentation/buyer_verification_required_screen';
import { useAccount } from '@/features/profile/profile_store';
import { backOrReplace } from '@/navigation/app_navigation';

export default function OrderCheckoutRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = useAccount();
  const data = useSyncExternalStore(marketplaceService.subscribe, marketplaceService.getState, marketplaceService.getState);
  const candidate = getCheckoutItem(id);
  const item = candidate?.sellerId && candidate.sellerId !== account.userId ? candidate : undefined;
  if (account.verification.status !== 'verified') return <BuyerVerificationRequiredScreen onBack={() => backOrReplace('/home')} onVerify={() => router.push('/account_verification')} />;
  return <OrderCheckoutScreen
    key={`${account.userId}:${item?.id ?? 'missing'}`} item={item} service={checkoutService} loadPickupPin={getOrderPickupPin}
    loading={data.loading} error={data.error} onRetry={marketplaceService.retry}
    receiverName={account.personal.fullName} receiverPhone={account.personal.phone}
    onReview={(listingId) => router.push({ pathname: '/order_review', params: { id: listingId } })}
    onBack={() => backOrReplace('/home')}
  />;
}
