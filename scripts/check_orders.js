const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

// Only the pure order model and service are loaded; no native runtime is needed.
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};

const { createCheckoutService } = require('../src/features/orders/application/checkout_service.ts');
const { emptyCheckoutForm, PICKUP_TIMES } = require('../src/features/orders/domain/checkout.ts');
const { createExampleReviewForm } = require('../src/features/orders/data/mock_order_review.ts');
const { mockCheckoutItem } = require('../src/features/orders/data/mock_checkout_item.ts');
const { createExampleOrderStatus } = require('../src/features/orders/data/mock_order_status.ts');
const { orderStatusCopy, orderProgress } = require('../src/features/orders/domain/order_status.ts');
const now = new Date(2026, 8, 30, 12);

test('delivery review carries destination, receiver, payment, and estimated total', () => {
  const service = createCheckoutService();
  const form = { ...createExampleReviewForm(now), payment: 'seller', receiver: ' Maria Santos ', notes: ' Call before arrival ' };
  const { draft, errors } = service.review(mockCheckoutItem, form, now);
  assert.deepEqual(errors, {});
  assert.equal(draft.delivery.receiver, 'Maria Santos');
  assert.equal(draft.delivery.phone, '09171234567');
  assert.equal(draft.delivery.notes, 'Call before arrival');
  assert.equal(draft.delivery.city, 'Tagum City');
  assert.equal(draft.payment, 'seller');
  assert.equal(draft.pickup, null);
  assert.equal(draft.totalMin, 47500);
  assert.equal(draft.totalMax, 48500);
  const restored = service.getForm(mockCheckoutItem.id);
  restored.city = 'Changed';
  assert.equal(service.getForm(mockCheckoutItem.id).city, 'Tagum City');
});

test('pickup retains its date and time and includes no delivery charge', () => {
  const service = createCheckoutService();
  const form = { ...emptyCheckoutForm(), pickupDate: '2026-10-01', pickupTime: PICKUP_TIMES[0] };
  const { draft } = service.review(mockCheckoutItem, form, now);
  assert.deepEqual(draft.pickup, { date: '2026-10-01', time: PICKUP_TIMES[0] });
  assert.equal(draft.delivery, null);
  assert.equal(draft.totalMin, 45000);
  assert.equal(draft.totalMax, 45000);
});

test('per kg prices use livestock weight in the review total', () => {
  const service = createCheckoutService();
  const item = { ...mockCheckoutItem, price: 100, priceUnit: 'per kg' };
  const { draft } = service.review(item, createExampleReviewForm(now), now);
  assert.equal(draft.totalMin, 47500);
  assert.equal(draft.totalMax, 48500);
});

test('requests require agreement, a checkout draft, and an available listing', () => {
  const service = createCheckoutService();
  assert.ok(service.saveRequest(mockCheckoutItem, true, now).error);
  service.review(mockCheckoutItem, createExampleReviewForm(now), now);
  assert.ok(service.saveRequest(mockCheckoutItem, false, now).error);
  assert.ok(service.saveRequest(undefined, true, now).error);
  assert.equal(service.getRequest(mockCheckoutItem.id), undefined);
});

test('a stale date or changed listing price cannot save an outdated review', () => {
  const service = createCheckoutService();
  service.review(mockCheckoutItem, createExampleReviewForm(now), now);
  assert.ok(service.saveRequest(mockCheckoutItem, true, new Date(2026, 9, 1, 12)).error);
  assert.ok(service.saveRequest({ ...mockCheckoutItem, price: 46000 }, true, now).error);
  assert.equal(service.getRequest(mockCheckoutItem.id), undefined);
});

test('saving twice returns one local request and never marks it sent or accepted', () => {
  const service = createCheckoutService();
  service.review(mockCheckoutItem, createExampleReviewForm(now), now);
  const first = service.saveRequest(mockCheckoutItem, true, now);
  const second = service.saveRequest(mockCheckoutItem, true, now);
  assert.equal(first.error, null);
  assert.equal(first.request.status, 'saved-locally');
  assert.equal(first.request.id, second.request.id);
  assert.equal(service.getRequest(mockCheckoutItem.id), first.request);
});

test('editing checkout creates a new review without altering a saved request', () => {
  const service = createCheckoutService();
  const form = createExampleReviewForm(now);
  service.review(mockCheckoutItem, form, now);
  const original = service.saveRequest(mockCheckoutItem, true, now).request;
  service.review(mockCheckoutItem, { ...form, landmark: 'New meeting point' }, now);
  assert.equal(service.getRequest(mockCheckoutItem.id), undefined);
  const updated = service.saveRequest(mockCheckoutItem, true, now).request;
  assert.notEqual(updated.id, original.id);
  assert.equal(original.draft.delivery.landmark, 'Near barangay hall');
  assert.equal(updated.draft.delivery.landmark, 'New meeting point');
});

test('status records remain available by order id after checkout is edited', () => {
  const service = createCheckoutService();
  const form = createExampleReviewForm(now);
  service.review(mockCheckoutItem, form, now);
  const original = service.saveRequest(mockCheckoutItem, true, now).request;
  service.review(mockCheckoutItem, { ...form, landmark: 'Updated address' }, now);
  assert.equal(service.getOrder(original.id).draft.delivery.landmark, 'Near barangay hall');
  assert.equal(service.getOrder('missing-order'), undefined);
});

test('cancellation preserves order details and is safe to repeat', () => {
  const service = createCheckoutService();
  service.review(mockCheckoutItem, createExampleReviewForm(now), now);
  const original = service.saveRequest(mockCheckoutItem, true, now).request;
  const cancelled = service.cancelRequest(original.id, now).request;
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancelledAt, now.toISOString());
  assert.equal(cancelled.draft.totalMin, 47500);
  assert.equal(service.getOrder(original.id), cancelled);
  assert.equal(service.getRequest(mockCheckoutItem.id), cancelled);
  assert.equal(service.cancelRequest(original.id, new Date(2026, 9, 1)).request.cancelledAt, now.toISOString());
  assert.ok(service.cancelRequest('missing-order', now).error);
});

test('cancelling an old request does not cancel a newer request for the listing', () => {
  const service = createCheckoutService();
  const form = createExampleReviewForm(now);
  service.review(mockCheckoutItem, form, now);
  const original = service.saveRequest(mockCheckoutItem, true, now).request;
  service.review(mockCheckoutItem, { ...form, notes: 'New request' }, now);
  const newer = service.saveRequest(mockCheckoutItem, true, now).request;
  service.cancelRequest(original.id, now);
  assert.equal(service.getOrder(original.id).status, 'cancelled');
  assert.equal(service.getRequest(mockCheckoutItem.id).id, newer.id);
  assert.equal(service.getOrder(newer.id).status, 'saved-locally');
});

test('a cancelled request can be replaced by a new reviewed request', () => {
  const service = createCheckoutService();
  service.review(mockCheckoutItem, createExampleReviewForm(now), now);
  const original = service.saveRequest(mockCheckoutItem, true, now).request;
  service.cancelRequest(original.id, now);
  const replacement = service.saveRequest(mockCheckoutItem, true, now).request;
  assert.notEqual(replacement.id, original.id);
  assert.equal(service.getOrder(original.id).status, 'cancelled');
  assert.equal(replacement.status, 'saved-locally');
});

test('the timeline uses delivery or pickup stages without advancing pending steps', () => {
  const example = createExampleOrderStatus(now);
  const delivery = orderProgress(example);
  assert.equal(delivery.length, 5);
  assert.equal(delivery[0].state, 'current');
  assert.ok(delivery.slice(1).every((stage) => stage.state === 'future'));
  assert.equal(delivery[4].title, 'Delivered');
  const pickup = orderProgress({ ...example, draft: { ...example.draft, fulfillment: 'pickup' } });
  assert.equal(pickup[2].title, 'Pickup scheduled');
  assert.equal(pickup[4].title, 'Completed');
});

test('local and cancelled statuses never claim that the seller was notified', () => {
  const example = createExampleOrderStatus(now);
  const local = { ...example, status: 'saved-locally' };
  assert.equal(orderStatusCopy(local).pill, 'Saved locally');
  assert.equal(orderProgress(local)[0].title, 'Request saved locally');
  const cancelled = { ...local, status: 'cancelled' };
  assert.equal(orderStatusCopy(cancelled).pill, 'Cancelled');
  assert.equal(orderProgress(cancelled)[0].state, 'cancelled');
  assert.ok(orderProgress(cancelled).every((stage) => stage.state !== 'current'));
});
