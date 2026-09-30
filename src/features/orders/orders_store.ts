import { useSyncExternalStore } from 'react';

import { checkoutService } from './orders_dependencies';

export function useOrders() {
  return useSyncExternalStore(checkoutService.subscribe, checkoutService.getSnapshot, checkoutService.getSnapshot);
}
