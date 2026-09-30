import { checkoutTotals, TRANSPORT_ESTIMATE, type OrderRequest } from '../domain/checkout';
import { mockCheckoutItem } from './mock_checkout_item';
import { createExampleReviewForm } from './mock_order_review';

export function createExampleOrderStatus(now = new Date()): OrderRequest {
  const form = createExampleReviewForm(now);
  const total = checkoutTotals(mockCheckoutItem, 'delivery')!;
  return {
    id: `ANM-${now.getFullYear()}-184205`, createdAt: now.toISOString(), status: 'awaiting-seller',
    draft: {
      item: { ...mockCheckoutItem }, payment: form.payment, fulfillment: 'delivery', pickup: null,
      delivery: {
        date: form.deliveryDate, receiver: form.receiver, phone: form.phone.replace(/\s/g, ''),
        street: form.street, barangay: form.barangay, city: form.city, province: form.province,
        postal: form.postal, landmark: form.landmark, notes: form.notes, accessibleDestination: true,
        feeMin: TRANSPORT_ESTIMATE.min, feeMax: TRANSPORT_ESTIMATE.max,
      },
      totalMin: total.min, totalMax: total.max,
    },
  };
}
