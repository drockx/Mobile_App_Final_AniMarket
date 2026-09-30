import { checkoutTotals, TRANSPORT_ESTIMATE, validateCheckout, type CheckoutDraft, type CheckoutForm, type CheckoutItem } from '../domain/checkout';

export function createCheckoutService() {
  // Matches the app's session-based demo stores. No order or payment is submitted here.
  const drafts = new Map<string, { form: CheckoutForm; draft: CheckoutDraft }>();
  return {
    getForm: (listingId: string): CheckoutForm | undefined => {
      const form = drafts.get(listingId)?.form;
      return form ? { ...form } : undefined;
    },
    getDraft: (listingId: string) => drafts.get(listingId)?.draft,
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
          feeMin: TRANSPORT_ESTIMATE.min, feeMax: TRANSPORT_ESTIMATE.max,
        } : null,
        totalMin: total.min, totalMax: total.max,
      };
      drafts.set(item.id, { form: { ...form }, draft });
      return { errors: {}, draft };
    },
  };
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;
