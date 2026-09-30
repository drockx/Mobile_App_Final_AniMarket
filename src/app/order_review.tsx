import { router, useLocalSearchParams } from 'expo-router';

import { checkoutService, getCheckoutItem, getOrderReview } from '@/features/orders/orders_dependencies';
import { OrderReviewScreen } from '@/features/orders/presentation/order_review_screen';
import { useAccount } from '@/features/profile/profile_store';

export default function OrderReviewRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = useAccount();
  const { draft, example } = getOrderReview(id);
  const listingId = draft?.item.id ?? id;
  const savedRequest = listingId ? checkoutService.getRequest(listingId) : undefined;
  const edit = () => router.navigate({ pathname: '/order_checkout', params: listingId ? { id: listingId } : {} });
  return <OrderReviewScreen
    key={listingId ?? 'missing'} draft={draft} example={example}
    buyerName={example ? '' : account.personal.fullName} buyerPhone={example ? '' : account.personal.phone}
    savedRequest={savedRequest?.status === 'cancelled' ? undefined : savedRequest}
    onBack={() => { if (router.canGoBack()) router.back(); else edit(); }}
    onEdit={edit}
    onViewListing={example || !listingId ? undefined : () => router.push({ pathname: '/listings/id', params: { id: listingId } })}
    onSave={(reviewed) => checkoutService.saveRequest(getCheckoutItem(listingId), reviewed)}
    onContinue={() => router.navigate('/home')}
    onStatus={(orderId) => router.replace({ pathname: '/order_status', params: { orderId } })}
  />;
}
