import { createCollectionStore, type CollectionRepository } from '@/services/collection';
import { createCheckoutService } from './checkout_service';
import { isOrderRecord, type CheckoutItem, type OrderRequest, type SaveOrderResult } from '../domain/checkout';
import type { Coordinate } from '../../location/domain/location';
import { canCancelOrder } from '../domain/order_status';

export type OwnedOrder = OrderRequest & { ownerId: string };

export function createOrderService(repository: CollectionRepository<OwnedOrder>) {
  let ownerId = '';
  const records = createCollectionStore(repository, (order) => isOrderRecord(order) && (order.ownerId === ownerId || order.sellerId === ownerId));
  const sessions = new Map<string, ReturnType<typeof createCheckoutService>>();
  let drafts = createCheckoutService();
  const pending = new Map<string, Promise<SaveOrderResult>>();
  function issue(error: unknown): SaveOrderResult { return { request: null, error: error instanceof Error ? error.message : 'Unable to save your order. Please retry.' }; }
  return {
    connectOwner(id: string) {
      if (id === ownerId) return;
      ownerId = id;
      drafts = sessions.get(id) ?? createCheckoutService();
      if (id) sessions.set(id, drafts);
      records.connect(id || null);
    },
    getSnapshot: records.getSnapshot, getState: records.getState, subscribe: records.subscribe, retry: records.retry,
    getForm: (id: string) => drafts.getForm(id), getDraft: (id: string) => drafts.getDraft(id),
    getRequest: (id: string) => [...records.getSnapshot()].reverse().find((item) => item.draft.item.id === id && !['cancelled', 'rejected', 'completed'].includes(item.status)),
    getOrder: (id: string) => records.getSnapshot().find((item) => item.id === id),
    review: (...args: Parameters<typeof drafts.review>) => drafts.review(...args),
    async updateStatus(id: string, status: OrderRequest['status']): Promise<SaveOrderResult> {
      const request = records.getSnapshot().find((entry) => entry.id === id);
      if (!request) return issue(new Error('This order is no longer available.'));
      try { return { request: await records.save({ ...request, status }), error: null }; } catch (error) { return issue(error); }
    },
    saveRequest(item: CheckoutItem | undefined, reviewed: boolean, now = new Date(), pickupPin?: Coordinate): Promise<SaveOrderResult> {
      if (!ownerId) return Promise.resolve(issue(new Error('Sign in before placing an order.')));
      if (records.getState().loading) return Promise.resolve(issue(new Error('Your orders are still loading. Please try again shortly.')));
      if (item?.sellerId === ownerId) return Promise.resolve(issue(new Error('You cannot order your own listing.')));
      if (!item?.sellerId) return Promise.resolve(issue(new Error('This listing has no connected seller. Choose another listing.')));
      const key = `${ownerId}:${item.id}`;
      const running = pending.get(key); if (running) return running;
      const existing = records.getSnapshot().find((entry) => entry.draft.item.id === item.id && !['cancelled', 'rejected', 'completed'].includes(entry.status));
      if (existing) return Promise.resolve(reviewed ? { request: existing, error: null } : issue(new Error('Review your order first.')));
      const previous = drafts.getRequest(item.id);
      if (previous && records.getSnapshot().some((entry) => entry.id === previous.id && ['cancelled', 'rejected', 'completed'].includes(entry.status))) drafts.releaseRequest(previous.id);
      const prepared = drafts.saveRequest(item, reviewed, now, pickupPin);
      if (!prepared.request) return Promise.resolve(prepared);
      const request: OwnedOrder = { ...prepared.request, ownerId };
      const operation = records.save(request).then((saved) => ({ request: saved, error: null })).catch(issue).finally(() => pending.delete(key));
      pending.set(key, operation); return operation;
    },
    async cancelRequest(id: string, now = new Date()): Promise<SaveOrderResult> {
      const request = records.getSnapshot().find((entry) => entry.id === id);
      if (!request) return issue(new Error('This order is no longer available for your account.'));
      if (request.ownerId !== ownerId) return issue(new Error('Only the buyer can cancel this request.'));
      if (request.status === 'cancelled') return { request, error: null };
      if (!canCancelOrder(request)) return issue(new Error('This order can no longer be cancelled. Contact the seller.'));
      const currentDrafts = drafts;
      try {
        const saved = await records.save({ ...request, status: 'cancelled', cancelledAt: now.toISOString() });
        currentDrafts.cancelRequest(id, now); return { request: saved, error: null };
      } catch (error) { return issue(error); }
    },
  };
}
export type OrderService = ReturnType<typeof createOrderService>;
