import type { OrderRequest } from './checkout';

export type OrderFilter = 'all' | 'active' | 'completed' | 'cancelled';

export function filterOrders(orders: readonly OrderRequest[], filter: OrderFilter, query: string) {
  const search = query.trim().toLocaleLowerCase();
  return orders.filter((order) => {
    if (filter === 'cancelled' && order.status !== 'cancelled' && order.status !== 'rejected') return false;
    if (filter === 'completed' && order.status !== 'completed') return false;
    if (filter === 'active' && ['cancelled', 'rejected', 'completed'].includes(order.status)) return false;
    return !search || [order.id, order.draft.item.title, order.draft.item.seller]
      .some((value) => value.toLocaleLowerCase().includes(search));
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
