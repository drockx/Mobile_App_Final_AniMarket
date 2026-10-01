import { router, useLocalSearchParams } from 'expo-router';

import { checkoutService, getOrderReview, saveOrderRequest } from '@/features/orders/orders_dependencies';
import { OrderReviewScreen } from '@/features/orders/presentation/order_review_screen';
import { useAccount } from '@/features/profile/profile_store';
import { openPlacedOrder, openSavedOrder } from '@/navigation/app_navigation';

export default function OrderReviewRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = useAccount();
  const { draft, example } = getOrderReview(id);
  const listingId = draft?.item.id ?? id;
  const savedRequest = listingId ? checkoutService.getRequest(listingId) : undefined;
  const edit = () => router.dismissTo({ pathname: '/order_checkout', params: listingId ? { id: listingId } : {} });
  return <OrderReviewScreen
    key={`${account.userId}:${listingId ?? 'missing'}`} draft={draft} example={example}
    buyerName={example ? '' : account.personal.fullName} buyerPhone={example ? '' : account.personal.phone}
    savedRequest={savedRequest?.status === 'cancelled' ? undefined : savedRequest}
    onBack={() => { if (router.canGoBack()) router.back(); else edit(); }}
    onEdit={edit}
    onViewListing={example || !listingId ? undefined : () => router.push({ pathname: '/listings/id', params: { id: listingId } })}
    onSave={(reviewed) => saveOrderRequest(listingId, reviewed)}
    onContinue={() => router.dismissTo('/home')}
    onStatus={openSavedOrder}
    onPlaced={openPlacedOrder}
  />;
}
