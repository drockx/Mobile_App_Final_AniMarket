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
const { emptyCheckoutForm, PICKUP_TIMES, selectDeliveryLocation, updateCheckoutField } = require('../src/features/orders/domain/checkout.ts');
const { createExampleReviewForm } = require('./fixtures/mock_order_review.ts');
const { mockCheckoutItem } = require('./fixtures/mock_checkout_item.ts');
const { createExampleOrderStatus } = require('./fixtures/mock_order_status.ts');
const { orderStatusCopy, orderProgress } = require('../src/features/orders/domain/order_status.ts');
const { filterOrders } = require('../src/features/orders/domain/order_list.ts');
const now = new Date(2026, 8, 30, 12);

test('a new city pin fills the new address and removes unrelated house details and landmarks', () => {
  const form = createExampleReviewForm(now);
  const location = { coordinate: { latitude: 7.3, longitude: 125.68 }, source: 'search', address: { label: 'Panabo', city: 'Panabo City', province: 'Davao del Norte', postalCode: '8105' } };
  const changed = selectDeliveryLocation(form, location);
  assert.equal(changed.city, 'Panabo City');
  assert.equal(changed.postal, '8105');
  assert.equal(changed.street, '');
  assert.equal(changed.barangay, '');
  assert.equal(changed.landmark, '');
  location.coordinate.latitude = 8;
  assert.equal(changed.deliveryLocation.coordinate.latitude, 7.3);
  assert.equal(form.city, 'Tagum City');
});

test('manual details remain editable when the reverse address is unavailable', () => {
  const form = selectDeliveryLocation(emptyCheckoutForm(), createExampleReviewForm(now).deliveryLocation);
  const city = updateCheckoutField(form, 'city', 'Tagum City');
  const province = updateCheckoutField(city, 'province', 'Davao del Norte');
  assert.deepEqual(province.deliveryLocation.coordinate, form.deliveryLocation.coordinate);
  const located = selectDeliveryLocation(createExampleReviewForm(now), { ...form.deliveryLocation, address: { label: 'Tagum', city: 'Tagum', province: 'Davao del Norte' } });
  assert.equal(located.street, 'Purok 2');
  assert.equal(updateCheckoutField(located, 'city', 'Tagum City').deliveryLocation, located.deliveryLocation);
  assert.equal(updateCheckoutField(located, 'city', 'Panabo City').deliveryLocation, null);
  assert.equal(updateCheckoutField(located, 'province', 'Davao Oriental').deliveryLocation, null);
  assert.equal(updateCheckoutField(located, 'street', 'Purok 3').deliveryLocation, located.deliveryLocation);
});

test('delivery requires a valid confirmed pin in the same city and province', () => {
  const service = createCheckoutService();
  const form = createExampleReviewForm(now);
  assert.ok(service.review(mockCheckoutItem, { ...form, deliveryLocation: null }, now).errors.deliveryLocation);
  assert.ok(service.review(mockCheckoutItem, { ...form, deliveryLocation: { ...form.deliveryLocation, coordinate: { latitude: NaN, longitude: 125 } } }, now).errors.deliveryLocation);
  const located = { ...form.deliveryLocation, address: { label: 'Selected point', city: 'Tagum City', province: 'Davao del Norte', countryCode: 'PH' } };
  assert.ok(service.review(mockCheckoutItem, { ...form, city: 'Panabo City', deliveryLocation: located }, now).errors.deliveryLocation);
  assert.ok(service.review(mockCheckoutItem, { ...form, province: 'Davao Oriental', deliveryLocation: located }, now).errors.deliveryLocation);
  assert.ok(service.review(mockCheckoutItem, { ...form, city: 'Tagum', deliveryLocation: located }, now).draft);
});

test('delivery coordinates remain fixed through form edits, request history and cancellation', () => {
  const service = createCheckoutService();
  const form = createExampleReviewForm(now);
  const originalPoint = { ...form.deliveryLocation.coordinate };
  service.review(mockCheckoutItem, form, now);
  form.deliveryLocation.coordinate.latitude = 8;
  const restored = service.getForm(mockCheckoutItem.id);
  restored.deliveryLocation.coordinate.longitude = 124;
  const request = service.saveRequest(mockCheckoutItem, true, now).request;
  assert.deepEqual(request.draft.delivery.location.coordinate, originalPoint);
  service.review(mockCheckoutItem, form, now);
  assert.deepEqual(service.getOrder(request.id).draft.delivery.location.coordinate, originalPoint);
  assert.deepEqual(service.cancelRequest(request.id, now).request.draft.delivery.location.coordinate, originalPoint);
});

test('seller pickup coordinates are copied into the placed order without modifying the public item', () => {
  const service = createCheckoutService();
  const form = { ...emptyCheckoutForm(), pickupDate: '2026-10-01', pickupTime: PICKUP_TIMES[0] };
  service.review(mockCheckoutItem, form, now);
  const point = { latitude: 7.4482, longitude: 125.807 };
  const request = service.saveRequest(mockCheckoutItem, true, now, point).request;
  point.latitude = 8;
  assert.equal(request.pickupPin.latitude, 7.4482);
  assert.equal(request.draft.item.pickupPin, undefined);
  assert.equal(service.cancelRequest(request.id, now).request.pickupPin.latitude, 7.4482);
});

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

test('My Orders publishes stable snapshots only when a request is placed or cancelled', () => {
  const service = createCheckoutService();
  const empty = service.getSnapshot();
  let updates = 0;
  const unsubscribe = service.subscribe(() => { updates++; });
  service.review(mockCheckoutItem, createExampleReviewForm(now), now);
  assert.equal(service.getSnapshot(), empty);
  assert.ok(service.saveRequest(mockCheckoutItem, false, now).error);
  assert.equal(updates, 0);
  const request = service.saveRequest(mockCheckoutItem, true, now).request;
  const placed = service.getSnapshot();
  assert.deepEqual(placed, [request]);
  assert.equal(service.getSnapshot(), placed);
  service.saveRequest(mockCheckoutItem, true, now);
  assert.equal(service.getSnapshot(), placed);
  assert.equal(updates, 1);
  service.cancelRequest(request.id, now);
  const cancelled = service.getSnapshot();
  assert.notEqual(cancelled, placed);
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].status, 'cancelled');
  assert.equal(placed[0].status, 'saved-locally');
  service.cancelRequest(request.id, now);
  assert.equal(service.getSnapshot(), cancelled);
  assert.equal(updates, 2);
  unsubscribe();
  service.saveRequest(mockCheckoutItem, true, now);
  assert.equal(updates, 2);
});

test('order history puts new requests first and retains cancelled requests and original details', () => {
  const service = createCheckoutService();
  const form = createExampleReviewForm(now);
  service.review(mockCheckoutItem, form, now);
  const first = service.saveRequest(mockCheckoutItem, true, now).request;
  service.cancelRequest(first.id, now);
  service.review(mockCheckoutItem, { ...form, notes: 'Updated arrangement' }, now);
  const second = service.saveRequest(mockCheckoutItem, true, now).request;
  assert.deepEqual(service.getSnapshot().map((order) => order.id), [second.id, first.id]);
  assert.equal(service.getSnapshot()[1].status, 'cancelled');
  assert.equal(service.getSnapshot()[1].draft.delivery.notes, form.notes);
});

test('My Orders filters status and searches livestock, seller, and order number without altering history', () => {
  const example = createExampleOrderStatus(now);
  const orders = [example, { ...example, id: 'cancelled-order', status: 'cancelled' }];
  assert.equal(filterOrders(orders, 'all', '').length, 2);
  assert.deepEqual(filterOrders(orders, 'active', ''), [example]);
  assert.equal(filterOrders(orders, 'cancelled', '')[0].id, 'cancelled-order');
  assert.equal(filterOrders(orders, 'all', '  BRAHMAN  ').length, 2);
  assert.equal(filterOrders(orders, 'active', 'juan').length, 1);
  assert.equal(filterOrders(orders, 'all', example.id).length, 1);
  assert.deepEqual(filterOrders(orders, 'active', 'cancelled-order'), []);
  assert.equal(orders.length, 2);
  assert.deepEqual(filterOrders([], 'all', ''), []);
});
