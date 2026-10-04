import { router, useLocalSearchParams } from 'expo-router';

import { checkoutService, getOrderReview, saveOrderRequest } from '@/features/orders/orders_dependencies';
import { OrderReviewScreen } from '@/features/orders/presentation/order_review_screen';
import { BuyerVerificationRequiredScreen } from '@/features/orders/presentation/buyer_verification_required_screen';
import { useAccount } from '@/features/profile/profile_store';
import { backOrReplace, openPlacedOrder, openSavedOrder } from '@/navigation/app_navigation';

export default function OrderReviewRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = useAccount();
  const { draft, example } = getOrderReview(id);
  const listingId = draft?.item.id ?? id;
  const savedRequest = listingId ? checkoutService.getRequest(listingId) : undefined;
  const edit = () => router.dismissTo({ pathname: '/order_checkout', params: listingId ? { id: listingId } : {} });
  if (account.verification.status !== 'verified' && !savedRequest) return <BuyerVerificationRequiredScreen onBack={() => backOrReplace('/home')} onVerify={() => router.push('/account_verification')} />;
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
