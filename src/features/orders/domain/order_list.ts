import type { OrderRequest } from './checkout';

export type OrderFilter = 'all' | 'active' | 'cancelled';

export function filterOrders(orders: readonly OrderRequest[], filter: OrderFilter, query: string) {
  const search = query.trim().toLocaleLowerCase();
  return orders.filter((order) => {
    if (filter === 'cancelled' && order.status !== 'cancelled') return false;
    if (filter === 'active' && order.status === 'cancelled') return false;
    return !search || [order.id, order.draft.item.title, order.draft.item.seller]
      .some((value) => value.toLocaleLowerCase().includes(search));
  });
}
