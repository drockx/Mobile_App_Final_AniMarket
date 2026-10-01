import { useSyncExternalStore } from 'react';

import { checkoutService } from './orders_dependencies';

export function useOrders() {
  return useSyncExternalStore(checkoutService.subscribe, checkoutService.getSnapshot, checkoutService.getSnapshot);
}
export function useOrderState() { return useSyncExternalStore(checkoutService.subscribe, checkoutService.getState, checkoutService.getState); }
