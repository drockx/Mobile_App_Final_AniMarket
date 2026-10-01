import { checkoutTotals, TRANSPORT_ESTIMATE, validateCheckout, type CheckoutDraft, type CheckoutForm, type CheckoutItem, type OrderRequest, type SaveOrderResult } from '../domain/checkout';
import { copyLocation, isCoordinate, type Coordinate } from '../../location/domain/location';
import { createRecordId } from '../../../services/development_data';

export function createCheckoutService() {
  // Matches the app's session-based demo stores. Requests stay local; no seller is notified.
  const drafts = new Map<string, { form: CheckoutForm; draft: CheckoutDraft; request?: OrderRequest }>();
  const requests = new Map<string, OrderRequest>();
  const listeners = new Set<() => void>();
  let snapshot: readonly OrderRequest[] = [];
  function publish() {
    snapshot = Array.from(requests.values()).reverse();
    listeners.forEach((listener) => listener());
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getForm: (listingId: string): CheckoutForm | undefined => {
      const form = drafts.get(listingId)?.form;
      return form ? { ...form, deliveryLocation: form.deliveryLocation ? copyLocation(form.deliveryLocation) : null } : undefined;
    },
    getDraft: (listingId: string) => drafts.get(listingId)?.draft,
    getRequest: (listingId: string) => drafts.get(listingId)?.request,
    getOrder: (orderId: string) => requests.get(orderId),
    releaseRequest(orderId: string) {
      for (const entry of drafts.values()) if (entry.request?.id === orderId) entry.request = undefined;
    },
    cancelRequest(orderId: string, now = new Date()): SaveOrderResult {
      const original = requests.get(orderId);
      if (!original) return { request: null, error: 'This order request is no longer available in this session.' };
      if (original.status === 'cancelled') return { request: original, error: null };
      const request: OrderRequest = { ...original, status: 'cancelled', cancelledAt: now.toISOString() };
      requests.set(orderId, request);
      const entry = drafts.get(request.draft.item.id);
      if (entry?.request?.id === orderId) entry.request = request;
      publish();
      return { request, error: null };
    },
    saveRequest(item: CheckoutItem | undefined, reviewed: boolean, now = new Date(), pickupPin?: Coordinate): SaveOrderResult {
      if (!reviewed) return { request: null, error: 'Confirm that you reviewed the order before continuing.' };
      if (!item) return { request: null, error: 'This listing is no longer available. Return to the marketplace.' };
      const entry = drafts.get(item.id);
      if (!entry) return { request: null, error: 'Complete checkout before saving an order request.' };
      if (Object.keys(validateCheckout(entry.form, item, now)).length) {
        return { request: null, error: 'Your checkout details need updating. Edit the order to check the date and required fields.' };
      }
      const original = entry.draft.item;
      if (original.price !== item.price || original.priceUnit !== item.priceUnit || original.weight !== item.weight) {
        return { request: null, error: 'The listing price or weight changed. Edit the order and review the updated total.' };
      }
      if (entry.request && entry.request.status !== 'cancelled') return { request: entry.request, error: null };
      const request: OrderRequest = {
        id: createRecordId(),
        createdAt: now.toISOString(), status: 'saved-locally', draft: entry.draft,
        pickupPin: isCoordinate(pickupPin) ? { ...pickupPin } : undefined,
      };
      entry.request = request;
      requests.set(request.id, request);
      publish();
      return { request, error: null };
    },
    review(item: CheckoutItem, form: CheckoutForm, now = new Date()) {
      const errors = validateCheckout(form, item, now);
      const total = checkoutTotals(item, form.fulfillment);
      if (Object.keys(errors).length || !total) return { errors, draft: null };
      const draft: CheckoutDraft = {
        item: { ...item }, payment: form.payment, fulfillment: form.fulfillment,
        pickup: form.fulfillment === 'pickup' ? { date: form.pickupDate, time: form.pickupTime } : null,
        delivery: form.fulfillment === 'delivery' ? {
          date: form.deliveryDate, receiver: form.receiver.trim(), phone: form.phone.replace(/[\s()-]/g, ''),
          street: form.street.trim(), barangay: form.barangay.trim(), city: form.city.trim(), province: form.province,
          postal: form.postal.trim(), landmark: form.landmark.trim(), notes: form.notes.trim(), accessibleDestination: true,
          location: copyLocation(form.deliveryLocation!),
          feeMin: TRANSPORT_ESTIMATE.min, feeMax: TRANSPORT_ESTIMATE.max,
        } : null,
        totalMin: total.min, totalMax: total.max,
      };
      drafts.set(item.id, { form: { ...form, deliveryLocation: form.deliveryLocation ? copyLocation(form.deliveryLocation) : null }, draft });
      return { errors: {}, draft };
    },
  };
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;
