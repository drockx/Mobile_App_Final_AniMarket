const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

// Exercise the same application services with empty and delayed providers, without a native runtime.
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  return resolve.call(this, name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2)) : name, parent, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { createCollectionStore, createMemoryCollection, createPrivateMemoryCollection } = require('../src/services/collection.ts');
const { createMarketplaceService } = require('../src/features/marketplace/application/marketplace_service.ts');
const { createLocalListingRepository } = require('../src/features/marketplace/data/local_listing_repository.ts');
const { createSellerListingsService } = require('../src/features/marketplace/application/seller_listings_service.ts');
const { createOrderService } = require('../src/features/orders/application/order_service.ts');
const { createNotificationStore } = require('../src/features/notifications/application/notification_service.ts');
const { estimatePrice } = require('../src/features/price_calculator/calculator.ts');
const { orderStatusCopy, orderProgress } = require('../src/features/orders/domain/order_status.ts');
const { filterOrders } = require('../src/features/orders/domain/order_list.ts');
const { emptyCheckoutForm, PICKUP_TIMES } = require('../src/features/orders/domain/checkout.ts');
const { loginDestination } = require('../src/navigation/login_destination.ts');
const { createLocalAppRepositories } = require('../src/data/app_repositories.ts');
const { isMarketRecord } = require('../src/features/market_reference/domain/market_reference.ts');
const { phoneUrl } = require('../src/utils/phone_url.ts');
const { initialSearchFilters, parseSearchFilters, serializeSearchFilters } = require('../src/features/marketplace/presentation/search_filter_params.ts');
const { emptyFilters, resetFilterOptions, toListingCriteria } = require('../src/features/marketplace/presentation/search_filters.ts');
const now = new Date(2026, 9, 1, 12);
const point = { latitude: 7.4482, longitude: 125.807 };
const criteria = { category: null, query: '', verifiedOnly: false };
const listing = (id = 'arbitrary_document_123', owner = 'seller-A') => ({
  id, seller: { id: owner, name: 'Real Seller', memberSince: '' }, title: 'Cow', category: 'Cow', price: 45000,
  verified: false, location: 'Tagum City, Davao del Norte', details: 'Healthy livestock', weight: '450 kg',
  age: '24 months', health: 'Healthy', healthVerification: { status: 'unverified' }, description: 'Available for inspection.',
});
const item = () => ({ id: 'arbitrary_document_123', title: 'Cow', weight: '450 kg', health: 'Healthy', seller: 'Real Seller', sellerId: 'seller-A', sellerAddress: 'Tagum City, Davao del Norte', price: 45000 });

test('opening filters starts with the current search and no hidden preset restrictions', () => {
  assert.deepEqual(initialSearchFilters({ query: 'Goat' }), { ...emptyFilters, query: 'Goat' });
  const filters = { ...emptyFilters, query: 'Breeding Goat', category: 'Goat', location: listing().location,
    minPrice: '5000', maxPrice: '12000', sort: 'price-asc', verifiedOnly: true, vaccinatedOnly: true };
  const params = serializeSearchFilters(filters);
  assert.deepEqual(parseSearchFilters(params), filters);
  delete params.applied;
  assert.deepEqual(initialSearchFilters(params), filters);
});

test('search and filter controls combine independently and reset keeps the search text', () => {
  const service = createMarketplaceService(createLocalListingRepository([
    { ...listing('breeding-goat'), title: 'Breeding Goat', category: 'Goat', price: 10000, verified: true, health: 'Vaccinated' },
    { ...listing('dairy-goat'), title: 'Dairy Goat', category: 'Goat', price: 8000, verified: true, health: 'Vaccinated' },
    { ...listing('unverified-goat'), title: 'Breeding Goat', category: 'Goat', price: 12000 },
    { ...listing('breeding-cow'), title: 'Breeding Cow', verified: true },
  ]));
  const filtered = { ...emptyFilters, query: 'Breeding', category: 'Goat', maxPrice: '10000',
    sort: 'price-asc', verifiedOnly: true, vaccinatedOnly: true };
  const ids = (filters) => service.findListings(toListingCriteria(filters)).map((record) => record.id);
  assert.deepEqual(ids(parseSearchFilters(serializeSearchFilters(filtered))), ['breeding-goat']);
  assert.deepEqual(ids({ ...filtered, query: '' }), ['dairy-goat', 'breeding-goat']);
  const reset = resetFilterOptions(filtered);
  assert.equal(reset.query, 'Breeding');
  assert.deepEqual(ids(reset).sort(), ['breeding-cow', 'breeding-goat', 'unverified-goat']);
});
const form = () => ({ ...emptyCheckoutForm(), pickupDate: '2026-10-02', pickupTime: PICKUP_TIMES[0] });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('empty collections have stable snapshots, no records, and a successful empty load', () => {
  const store = createCollectionStore(createMemoryCollection()); store.connect('public');
  assert.deepEqual(store.getSnapshot(), []); assert.equal(store.getState().loading, false);
  assert.equal(store.getSnapshot(), store.getSnapshot()); assert.equal(store.getState().error, null);
});
test('the complete app data bootstrap can start without any sample records', () => {
  const providers = createLocalAppRepositories();
  for (const repository of Object.values(providers)) {
    let snapshot; repository.watch('public', (items) => { snapshot = items; }, assert.fail); assert.deepEqual(snapshot, []);
  }
});
test('invalid remote market records produce an error instead of crashing a screen', () => {
  const repository = createMemoryCollection([{ id: 'broken-market', name: 'Market', location: 'Tagum', prices: null }]);
  const store = createCollectionStore(repository, isMarketRecord); store.connect('public'); assert.ok(store.getState().error); assert.deepEqual(store.getSnapshot(), []);
});
test('stale subscriptions and write completions cannot leak across accounts', async () => {
  const callbacks = new Map(); const pending = deferred();
  const store = createCollectionStore({ watch(scope, receive) { callbacks.set(scope, receive); return () => {}; }, save: () => pending.promise, remove: async () => {} });
  store.connect('A'); callbacks.get('A')([{ id: 'private-A' }]);
  const write = store.save({ id: 'new-A' }); store.connect('B'); callbacks.get('B')([{ id: 'private-B' }]);
  callbacks.get('A')([{ id: 'late-A' }]); pending.resolve({ id: 'new-A' });
  await assert.rejects(write, /account changed/); assert.deepEqual(store.getSnapshot(), [{ id: 'private-B' }]);
  store.connect(null); assert.deepEqual(store.getSnapshot(), []); await assert.rejects(store.save({ id: 'x' }), /Sign in/);
});
test('failed writes preserve existing data and supply an actionable error', async () => {
  const store = createCollectionStore({ watch(_scope, receive) { receive([{ id: 'one', price: 100 }]); return () => {}; }, save: async () => { throw new Error('Network unavailable'); }, remove: async () => { throw new Error('Delete denied'); } });
  store.connect('A'); await assert.rejects(store.save({ id: 'one', price: 200 }), /Network unavailable/);
  assert.equal(store.getSnapshot()[0].price, 100); assert.equal(store.getState().error, 'Network unavailable');
  await assert.rejects(store.remove('one'), /Delete denied/); assert.equal(store.getSnapshot().length, 1);
});
test('acknowledgements render before delayed subscriptions and do not overwrite newer updates', async () => {
  let receive; const pending = deferred();
  const store = createCollectionStore({ watch(_scope, callback) { receive = callback; callback([]); return () => {}; }, save: async (scope, value) => value.id === 'new' ? value : pending.promise, remove: async () => {} });
  store.connect('A'); await store.save({ id: 'new', value: 1 }); assert.equal(store.getSnapshot()[0].value, 1);
  const write = store.save({ id: 'new', value: 2 }); await write;
  receive([{ id: 'other', value: 1 }]); const delayed = store.save({ id: 'other', value: 2 });
  receive([{ id: 'other', value: 3 }]); pending.resolve({ id: 'other', value: 2 }); await delayed;
  assert.equal(store.getSnapshot()[0].value, 3);
});
test('load failure and retry distinguish an error from an empty catalog', () => {
  let attempt = 0;
  const store = createCollectionStore({ watch(_scope, receive, fail) { if (++attempt === 1) fail(new Error('Offline')); else receive([]); return () => {}; }, save: async (_scope, value) => value, remove: async () => {} });
  store.connect('public'); assert.equal(store.getState().error, 'Offline'); store.retry(); assert.equal(store.getState().error, null); assert.deepEqual(store.getSnapshot(), []);
});
test('duplicate and missing document IDs are rejected without replacing good data', () => {
  let receive;
  const store = createCollectionStore({ watch(_scope, callback) { receive = callback; callback([{ id: 'good' }]); return () => {}; }, save: async (_scope, value) => value, remove: async () => {} });
  store.connect('public'); receive([{ id: 'duplicate' }, { id: 'duplicate' }]); assert.ok(store.getState().error); assert.equal(store.getSnapshot()[0].id, 'good');
  receive([{ id: '' }]); assert.ok(store.getState().error);
});
test('private providers enforce account ownership on reads, writes and deletion', async () => {
  const repo = createPrivateMemoryCollection(); await repo.save('A', { id: 'private', ownerId: 'A' });
  let items; repo.watch('B', (value) => { items = value; }); assert.deepEqual(items, []);
  await assert.rejects(repo.save('B', { id: 'private', ownerId: 'B' }), /unavailable/);
  await assert.rejects(repo.remove('B', 'private'), /unavailable/);
});
test('arbitrary listing IDs synchronize edits, pause, resume and deletion with the public catalog', async () => {
  const service = createMarketplaceService(createLocalListingRepository([listing()])); service.connectOwner('seller-A');
  const own = createSellerListingsService(service); assert.equal(own.getSnapshot().length, 1);
  await service.updatePrice(listing().id, 47000); assert.equal(service.getListing(listing().id).price, 47000); assert.equal(own.getSnapshot()[0].price, 47000);
  await service.setPaused(listing().id, true); assert.equal(service.findListings(criteria).length, 0); assert.equal(own.getSnapshot()[0].status, 'paused');
  await service.setPaused(listing().id, false); assert.equal(service.findListings(criteria).length, 1);
  await service.remove(listing().id); assert.equal(service.getListing(listing().id), undefined); assert.deepEqual(own.getSnapshot(), []);
  await assert.rejects(service.updatePrice('missing', 500), /no longer available/);
});
test('confirmed listing edits also update the catalog before delayed remote watch events', async () => {
  const initial = listing();
  const service = createMarketplaceService({ watch(_scope, receive) { receive([initial]); return () => {}; }, save: async (_scope, value) => value, remove: async () => {}, publish: async (_scope, value) => value, loadPickupPin: async () => undefined });
  service.connectOwner('seller-A'); await service.updatePrice(initial.id, 48000); assert.equal(service.getListing(initial.id).price, 48000);
  await service.setPaused(initial.id, true); assert.equal(service.getListing(initial.id), undefined);
  await service.setPaused(initial.id, false); assert.equal(service.getListing(initial.id).price, 48000);
  await service.remove(initial.id); assert.equal(service.getListing(initial.id), undefined);
});
test('no fixtures are needed to publish and account switching hides other sellers private listings', async () => {
  const service = createMarketplaceService(createLocalListingRepository()); const own = createSellerListingsService(service);
  service.connectOwner('seller-A'); const { id, ...input } = listing(); const saved = await service.publishListing(input, point);
  assert.ok(saved.id); assert.equal(service.getListing(saved.id).title, 'Cow'); assert.deepEqual(await service.loadPickupPin(saved.id, 'buyer-B'), point);
  assert.equal(service.getListing(saved.id).pickupPin, undefined); assert.equal(own.getSnapshot().length, 1);
  service.connectOwner('seller-B'); assert.deepEqual(own.getSnapshot(), []); await assert.rejects(service.remove(saved.id), /account/);
  service.connectOwner('seller-A'); assert.equal(own.getSnapshot().length, 1);
  await assert.rejects(service.publishListing({ ...input, price: NaN }, point), /valid price/);
  await assert.rejects(service.publishListing(input, { latitude: 10, longitude: 120 }), /Davao del Norte/);
});
test('a lost publication acknowledgement retries the same document without duplicating livestock', async () => {
  const repo = createLocalListingRepository(); let calls = 0;
  const service = createMarketplaceService({ ...repo, async publish(...args) { const saved = await repo.publish(...args); if (++calls === 1) throw new Error('Acknowledgement lost'); return saved; } });
  service.connectOwner('seller-A'); const { id, ...input } = listing();
  await assert.rejects(service.publishListing(input, point, undefined, 'creation-operation'), /Acknowledgement lost/);
  const saved = await service.publishListing(input, point, undefined, 'creation-operation');
  assert.equal(saved.id, 'creation-operation'); assert.equal(service.findListings(criteria).length, 1); assert.equal(service.getOwnedSnapshot().length, 1);
});
test('orders work without fixtures, await saves, reject missing sellers and prevent self-ordering', async () => {
  const service = createOrderService(createPrivateMemoryCollection()); service.connectOwner('buyer-B', true); assert.deepEqual(service.getSnapshot(), []);
  assert.equal(service.getOrder('missing'), undefined); assert.equal(service.getDraft('missing'), undefined);
  assert.ok((await service.saveRequest(undefined, true, now)).error);
  service.review(item(), form(), now); const saved = await service.saveRequest(item(), true, now, point);
  assert.ok(saved.request); assert.equal(saved.request.ownerId, 'buyer-B'); assert.equal(saved.request.status, 'saved-locally');
  assert.equal(service.getOrder(saved.request.id).draft.item.id, item().id);
  assert.equal((await service.saveRequest(item(), true, now)).request.id, saved.request.id); assert.equal(service.getSnapshot().length, 1);
  service.connectOwner('seller-A', true); assert.deepEqual(service.getSnapshot(), []); assert.ok((await service.saveRequest(item(), true, now)).error);
  service.connectOwner('buyer-B', true); assert.equal(service.getSnapshot().length, 1); assert.ok((await service.cancelRequest(saved.request.id, now)).request);
});
test('drafts retain their full data and publish using the same opaque document ID', async () => {
  const service = createMarketplaceService(createLocalListingRepository()); service.connectOwner('seller-A');
  const { id, ...input } = listing(); const draft = await service.saveDraft({ ...input, title: '', price: 0, description: 'Typing visible description', imageUris: ['file://photo.jpg'], vaccinationDate: '2026-09-01', vaccineName: 'Vaccine' }, point);
  assert.equal(service.findListings(criteria).length, 0); assert.equal(service.getOwnedSnapshot()[0].status, 'draft');
  const restored = service.getOwnedSnapshot()[0]; assert.equal(restored.description, 'Typing visible description'); assert.deepEqual(restored.imageUris, ['file://photo.jpg']); assert.equal(restored.vaccineName, 'Vaccine');
  const saved = await service.publishListing({ ...restored, title: 'Cow', price: 45000 }, point, draft.id);
  assert.equal(saved.id, draft.id); assert.equal(service.getOwnedSnapshot().length, 1); assert.equal(service.findListings(criteria).length, 1);
  await assert.rejects(service.publishListing(input, point, draft.id), /already been published/);
});
test('a failed order save retries the same request ID and does not fabricate a placed order', async () => {
  const repo = createPrivateMemoryCollection(); let calls = 0; const ids = [];
  const service = createOrderService({ ...repo, async save(scope, value) { ids.push(value.id); if (++calls === 1) throw new Error('Offline'); return repo.save(scope, value); } });
  service.connectOwner('buyer-B', true); service.review(item(), form(), now);
  assert.equal((await service.saveRequest(item(), true, now)).request, null); assert.deepEqual(service.getSnapshot(), []);
  const saved = await service.saveRequest(item(), true, now); assert.ok(saved.request); assert.equal(ids[0], ids[1]);
});
test('concurrent order taps make one write and a changed account rejects a late save', async () => {
  const pending = deferred(); let calls = 0;
  const service = createOrderService({ watch(_scope, receive) { receive([]); return () => {}; }, save: async (_scope, value) => { calls++; await pending.promise; return value; }, remove: async () => {} });
  service.connectOwner('buyer-B', true); service.review(item(), form(), now);
  const first = service.saveRequest(item(), true, now); const second = service.saveRequest(item(), true, now); assert.equal(first, second); assert.equal(calls, 1);
  service.connectOwner('buyer-C'); pending.resolve(); assert.match((await first).error, /account changed/); assert.deepEqual(service.getSnapshot(), []);
});
test('order subscription status updates are reflected in the timeline and filters', async () => {
  const repo = createPrivateMemoryCollection(); const service = createOrderService(repo);
  service.connectOwner('buyer-B', true); service.review(item(), form(), now); const request = (await service.saveRequest(item(), true, now)).request;
  await repo.save('buyer-B', { ...request, status: 'completed' });
  const updated = service.getOrder(request.id); assert.equal(orderStatusCopy(updated).pill, 'Completed'); assert.ok(orderProgress(updated).every((stage) => stage.state === 'complete'));
  assert.equal(filterOrders(service.getSnapshot(), 'active', '').length, 0); assert.equal(filterOrders(service.getSnapshot(), 'completed', '').length, 1);
  assert.ok((await service.cancelRequest(updated.id)).error);
  await repo.save('buyer-B', { ...request, status: 'rejected' });
  const replacement = await service.saveRequest(item(), true, now); assert.ok(replacement.request); assert.notEqual(replacement.request.id, request.id);
  assert.equal(service.getOrder(request.id).status, 'rejected');
});
test('only verified buyers can create orders; approval updates preserve drafts and existing order actions', async () => {
  const repo = createPrivateMemoryCollection(); let writes = 0;
  const service = createOrderService({ ...repo, async save(...args) { writes++; return repo.save(...args); } });
  service.connectOwner('buyer-B'); service.review(item(), form(), now);
  assert.match((await service.saveRequest(item(), true, now)).error, /ID approval/);
  assert.equal(writes, 0); assert.deepEqual(service.getSnapshot(), []); assert.ok(service.getDraft(item().id));
  service.connectOwner('buyer-B', true);
  const saved = await service.saveRequest(item(), true, now); assert.ok(saved.request); assert.equal(writes, 1);
  service.connectOwner('buyer-B', false);
  assert.match((await service.saveRequest(item(), true, now)).error, /ID approval/); assert.equal(writes, 1);
  assert.ok((await service.cancelRequest(saved.request.id, now)).request); assert.equal(writes, 2);
  service.connectOwner('buyer-C'); service.review(item(), form(), now);
  assert.match((await service.saveRequest(item(), true, now)).error, /ID approval/); assert.equal(writes, 2);
});
test('notifications use real IDs, isolate read state and accept empty event lists', async () => {
  const store = createNotificationStore(createPrivateMemoryCollection()); const event = { id: 'same-conversation-event', conversationId: 'opaque_chat_doc', category: 'message', section: 'today', title: 'Real message', description: 'Hello', meta: '', action: 'Open', destination: 'messages', unread: true, icon: 'message' };
  store.connectOwner('A'); store.replaceEvents([event]); await store.markRead(event.id); assert.equal(store.getSnapshot()[0].unread, false);
  store.connectOwner('B'); store.replaceEvents([event]); assert.equal(store.getSnapshot()[0].unread, true); await store.markAllRead(); assert.equal(store.getSnapshot()[0].unread, false);
  store.connectOwner('A'); store.replaceEvents([event]); assert.equal(store.getSnapshot()[0].unread, false); store.replaceEvents([]); assert.deepEqual(store.getSnapshot(), []);
  store.connectOwner(''); store.replaceEvents([event]); assert.deepEqual(store.getSnapshot(), []);
});
test('missing or invalid rates do not invent an estimate; supplied market prices control the result', () => {
  const input = { category: 'cattle', province: 'Davao del Norte', weight: 450, age: 24, condition: 'B', purpose: 'general' };
  assert.equal(estimatePrice(input), null); assert.equal(estimatePrice(input, [NaN, 125]), null); assert.equal(estimatePrice(input, [125, 100]), null);
  assert.equal(estimatePrice({ ...input, weight: Infinity }, [100, 125]), null); assert.equal(estimatePrice({ ...input, age: 0 }, [100, 125]), null);
  const result = estimatePrice(input, [100, 125]); assert.equal(result.minimum, 45000); assert.equal(result.maximum, 56250);
  assert.equal(estimatePrice(input, [200, 250]).minimum, result.minimum * 2);
});
test('sign-in preserves opaque checkout IDs and rejects unsafe return destinations', () => {
  assert.deepEqual(loginDestination('/order_checkout?id=opaque_doc-123'), { pathname: '/order_checkout', params: { id: 'opaque_doc-123' } });
  assert.equal(loginDestination('/order_checkout?id=%2F%2Fevil.example'), '/home'); assert.equal(loginDestination('https://evil.example'), '/home');
});
test('seller calling accepts only explicit phone numbers and rejects arbitrary links', () => {
  assert.equal(phoneUrl('+63 912 345 6789'), 'tel:+639123456789'); assert.equal(phoneUrl('0912-345-6789'), 'tel:09123456789');
  assert.equal(phoneUrl(undefined), null); assert.equal(phoneUrl('https://example.com'), null); assert.equal(phoneUrl('tel:+639123456789?extra=1'), null); assert.equal(phoneUrl('123'), null);
});
