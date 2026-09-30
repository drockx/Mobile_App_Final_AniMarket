import { router, type Href } from 'expo-router';

export function backOrReplace(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

export function openPlacedOrder(orderId: string) {
  // Complete the checkout stack. Native back from confirmation returns to My Orders.
  if (router.canDismiss()) router.dismissAll();
  router.replace('/my_orders');
  router.push({ pathname: '/order_placed', params: { orderId } });
}

export function openSavedOrder(orderId: string) {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/my_orders');
  router.push({ pathname: '/order_status', params: { orderId } });
}
