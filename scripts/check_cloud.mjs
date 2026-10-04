import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccounts } from '../supabase/functions/animarket/records.mjs';
import { createChat } from '../supabase/functions/animarket/chat.mjs';
import { createCalls } from '../supabase/functions/animarket/calls.mjs';
import { createCommerce } from '../supabase/functions/animarket/commerce.mjs';
import { createAccountActions } from '../supabase/functions/animarket/account_actions.mjs';
import { createFirestore, decodeValue, encodeValue, encodeFields } from '../supabase/functions/animarket/firestore.mjs';
import { documentBytes, imageBytes } from '../supabase/functions/animarket/media.mjs';
import { inside } from '../supabase/functions/animarket/geofence.mjs';
import { createMaintenance } from '../supabase/functions/animarket/maintenance.mjs';
import { authorizeAction, authorizeProfile } from '../supabase/functions/animarket/session_access.mjs';

test('Staff accounts need a trusted reviewer role and can only review IDs without a customer profile', () => {
  assert.throws(() => authorizeProfile('staff', null, null), /Reviewer/);
  assert.throws(() => authorizeProfile('staff', null, { reviewer: 'true' }), /Reviewer/);
  const scope = authorizeProfile('staff', null, { reviewer: true }, true);
  assert.equal(scope.reviewOnly, true);
  for (const path of ['/verification/reviews', '/verification/reviews/customer']) authorizeAction(scope, path);
  for (const path of ['/auth/photo', '/auth/email', '/uploads', '/orders/save', '/verification/id', '/calls', '/conversations']) assert.throws(() => authorizeAction(scope, path), /only review/);
  assert.throws(() => authorizeProfile('user', { id: 'user', acceptedTerms: false }), /registration/);
  assert.equal(authorizeProfile('user', { id: 'user', acceptedTerms: true }).reviewOnly, false);
});

function fixture() {
  const rows = new Map(); let timestamp = Date.parse('2026-10-02T04:00:00Z'); let queue = Promise.resolve();
  const clone = (value) => value == null ? null : structuredClone(value);
  const get = async (path) => clone(rows.get(path));
  const query = async (collection, filters = []) => [...rows].filter(([path, value]) => path.startsWith(`${collection}/`) && path.split('/').length === collection.split('/').length + 1 && filters.every(({ fieldFilter: f }) => {
    const actual = f.field.fieldPath.split('.').reduce((result, part) => result?.[part], value); const expected = decodeValue(f.value);
    return f.op === 'ARRAY_CONTAINS' ? actual?.includes(expected) : f.op === 'LESS_THAN_OR_EQUAL' ? actual != null && actual <= expected : actual === expected;
  })).map(([, value]) => clone(value));
  const store = { get, query, transact(action) {
    const task = queue.catch(() => {}).then(async () => { const changes = []; const value = await action({ get, getAll: (paths) => Promise.all(paths.map(get)), query, set: (path, row) => changes.push([path, clone(row)]), delete: (path) => changes.push([path, null]) }); for (const [path, row] of changes) if (row === null) rows.delete(path); else rows.set(path, row); return value; }); queue = task; return task;
  } };
  const deleted = [];
  const media = { publicPhoto: async (uid, photo, id) => { imageBytes(photo); return { url: `https://res.cloudinary.com/dnbmd5qhj/image/upload/animarket/${uid}/${id}.png`, publicId: `animarket/${uid}/${id}` }; }, deletePublic: async (path) => deleted.push(path), privatePhoto: async (_bucket, _path, photo) => imageBytes(photo), privateDocument: async (_bucket, _path, photo) => documentBytes(photo), privateRead: async () => 'data:image/png;base64,test', privateDelete: async (_bucket, path) => deleted.push(path) };
  const now = () => timestamp;
  for (const uid of ['seller', 'buyer', 'outsider', 'reviewer']) rows.set(`users/${uid}`, { id: uid, username: `${uid} User`, personal: { fullName: `${uid} User`, phone: '09123456789', email: `${uid}@example.invalid`, city: 'Tagum City' }, acceptedTerms: true, createdAt: new Date(timestamp).toISOString(), avatar: null });
  rows.set('roles/reviewer', { reviewer: true }); rows.set('verifications/seller', { status: 'verified', fullName: 'seller User', idType: 'National ID' });
  const accounts = createAccounts({ store, now }); const chat = createChat({ store, accounts, now }); const calls = createCalls({ store, accounts, chat, now });
  const authChanges = [];
  return { rows, store, accounts, chat, media, deleted, authChanges, tick: (amount) => { timestamp += amount; }, commerce: createCommerce({ store, accounts, media, now }), calls, maintenance: createMaintenance({ store, media, calls, now }), account: createAccountActions({ store, accounts, media, now, authAdmin: async (_action, body) => authChanges.push(body) }) };
}
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1sAAAAASUVORK5CYII=';
const listing = (id = 'livestock') => ({ id, status: 'active', title: 'Cow for sale', category: 'Cow', details: '', price: 45000, priceUnit: 'per head', location: 'Tagum City, Davao del Norte', weight: '450 kg', age: '2 years', health: 'Vaccinated', description: 'Healthy cow', imageUris: [] });
const pin = { latitude: 7.4475, longitude: 125.8078 };
const order = (item, id = 'order') => ({ id, ownerId: 'buyer', status: 'saved-locally', draft: { item, payment: 'cod', fulfillment: 'pickup', pickup: { date: '2026-10-03', time: '8:00 AM–10:00 AM' }, delivery: null, totalMin: 1, totalMax: 1 } });

test('Firestore serialization and province geometry agree with strict media validation', () => {
  const value = { strings: ['Cow'], nested: { pin }, price: 45.25, nothing: null, verified: false }; assert.deepEqual(decodeValue(encodeValue(value)), value);
  assert.equal(inside(pin), true); assert.equal(inside({ latitude: 14.5995, longitude: 120.9842 }), false); assert.equal(inside({ latitude: NaN, longitude: 125 }), false);
  assert.equal(imageBytes(png).mime, 'image/png'); assert.throws(() => imageBytes('aGVsbG8=')); assert.equal(documentBytes(btoa('%PDF-1.4\ncontent\n%%EOF')).mime, 'application/pdf'); assert.throws(() => imageBytes(btoa('%PDF-1.4\ncontent\n%%EOF')));
});

test('transaction batch reads preserve request order, missing documents and the same transaction', async () => {
  const requests = [];
  const prefix = 'projects/test-project/databases/(default)/documents';
  const store = createFirestore({ project: 'test-project', accessToken: async () => 'test-token', fetcher: async (url, options) => {
    const body = JSON.parse(options.body); requests.push({ url, body });
    if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'transaction-id' });
    if (url.endsWith(':batchGet')) return Response.json([
      { missing: `${prefix}/rows/missing` },
      { found: { name: `${prefix}/rows/last`, fields: encodeFields({ id: 'last' }) } },
      { found: { name: `${prefix}/rows/first`, fields: encodeFields({ id: 'first' }) } },
    ]);
    assert.ok(url.endsWith(':commit')); return Response.json({});
  } });
  const result = await store.transact((tx) => tx.getAll(['rows/first', 'rows/missing', 'rows/last', 'rows/first']));
  assert.deepEqual(result, [{ id: 'first' }, null, { id: 'last' }, { id: 'first' }]);
  assert.equal(requests.length, 3);
  assert.equal(requests[1].body.transaction, 'transaction-id');
  assert.equal(requests[2].body.transaction, 'transaction-id');
  assert.deepEqual(requests[1].body.documents, ['first', 'missing', 'last', 'first'].map((id) => `${prefix}/rows/${id}`));
});
test('Listings enforce seller verification, real image ownership, geofence, and idempotence', async () => {
  const f = fixture(); await assert.rejects(f.commerce('buyer', '/listings/publish', { listing: listing(), pickupPin: pin }, 'POST'), /government/);
  await assert.rejects(f.commerce('seller', '/listings/publish', { listing: listing(), pickupPin: { latitude: 0, longitude: 0 } }, 'POST'), /Davao/);
  const uploaded = await f.commerce('seller', '/uploads', { kind: 'listing', photo: png }, 'POST');
  const input = { ...listing(), imageUris: [uploaded.uri] };
  await assert.rejects(f.commerce('buyer', '/listings/publish', { listing: { ...input, status: 'draft' } }, 'POST'), /photos/);
  const saved = await f.commerce('seller', '/listings/publish', { listing: input, pickupPin: pin }, 'POST'); assert.equal(saved.listing.verified, true); assert.equal(saved.listing.healthVerification.status, 'unverified'); assert.equal(saved.listing.seller.id, 'seller'); assert.equal(saved.listing.pickupPin, undefined);
  assert.deepEqual(await f.commerce('seller', '/listings/publish', { listing: input, pickupPin: pin }, 'POST'), saved);
  await assert.rejects(f.commerce('buyer', '/listings/livestock/remove', {}, 'POST'), /another seller/);
});
test('Order totals and workflow are canonical, role checked, persistent and reserve once', async () => {
  const f = fixture(); const { listing: saved } = await f.commerce('seller', '/listings/publish', { listing: listing(), pickupPin: pin }, 'POST');
  const input = order(saved); const placed = (await f.commerce('buyer', '/orders/save', { order: input }, 'POST')).order;
  assert.equal(placed.status, 'awaiting-seller'); assert.equal(placed.draft.totalMin, 45000); assert.equal(placed.sellerId, 'seller'); assert.deepEqual(placed.participants, ['buyer', 'seller']); assert.deepEqual(placed.pickupPin, pin);
  await assert.rejects(f.commerce('outsider', '/orders/save', { order: { ...placed, status: 'accepted' } }, 'POST'), /unavailable/);
  await assert.rejects(f.commerce('buyer', '/orders/save', { order: { ...placed, status: 'accepted' } }, 'POST'), /action/);
  const other = await f.commerce('outsider', '/orders/save', { order: { ...order(saved, 'another'), ownerId: 'outsider' } }, 'POST');
  const accepted = (await f.commerce('seller', '/orders/save', { order: { ...placed, status: 'accepted' } }, 'POST')).order;
  await assert.rejects(f.commerce('seller', '/orders/save', { order: { ...other.order, status: 'accepted' } }, 'POST'), /reserved/);
  await assert.rejects(f.commerce('seller', '/listings/livestock/save', { listing: saved }, 'POST'), /active order/);
  assert.equal((await f.store.get('listings/livestock')).status, 'paused');
  let current = accepted; for (const status of ['scheduled', 'ready']) current = (await f.commerce('seller', '/orders/save', { order: { ...current, status } }, 'POST')).order;
  current = (await f.commerce('buyer', '/orders/save', { order: { ...current, status: 'completed' } }, 'POST')).order;
  assert.equal(current.status, 'completed'); assert.equal((await f.store.get('listings/livestock')).status, 'sold');
});
test('Messages are member-only, ordered, idempotent and monotonic in read position', async () => {
  const f = fixture(); const { conversation } = await f.chat.handle('buyer', '/conversations', { recipientId: 'seller' }, 'POST'); const path = `/conversations/${conversation.id}`;
  assert.equal((await f.chat.handle('seller', '/conversations', { recipientId: 'buyer' }, 'POST')).conversation.id, conversation.id);
  await assert.rejects(f.chat.handle('outsider', `${path}/messages`, { text: 'intrusion', clientId: 'one' }, 'POST'), /unavailable/);
  const sent = await f.chat.handle('buyer', `${path}/messages`, { text: 'Hello', clientId: 'one' }, 'POST'); assert.equal(sent.message.seq, 1);
  assert.deepEqual(await f.chat.handle('buyer', `${path}/messages`, { text: 'Hello', clientId: 'one' }, 'POST'), sent);
  await assert.rejects(f.chat.handle('buyer', `${path}/messages`, { text: 'Changed', clientId: 'one' }, 'POST'), /already used/);
  await f.chat.handle('seller', `${path}/read`, { throughSeq: 1 }, 'POST'); await f.chat.handle('seller', `${path}/read`, { throughSeq: 0 }, 'POST'); assert.equal((await f.store.get(`conversations/${conversation.id}`)).readBy.seller, 1);
});
test('Calls enforce participants, callee answer, locks, voice-only signals and stale cleanup', async () => {
  const f = fixture(); const { conversation } = await f.chat.handle('buyer', '/conversations', { recipientId: 'seller' }, 'POST');
  const { call } = await f.calls.handle('buyer', '/calls', { conversationId: conversation.id, clientId: 'one' }, 'POST'); const path = `/calls/${call.id}`;
  await assert.rejects(f.calls.handle('buyer', '/calls', { conversationId: conversation.id, clientId: 'two' }, 'POST'), /active call/);
  await assert.rejects(f.calls.handle('buyer', `${path}/accept`, {}, 'POST'), /called user/); await assert.rejects(f.calls.handle('outsider', `${path}/accept`, {}, 'POST'), /unavailable/);
  await f.calls.handle('seller', `${path}/accept`, {}, 'POST');
  await assert.rejects(f.calls.handle('buyer', `${path}/signals`, { type: 'offer', clientId: 'offer', payload: { type: 'offer', sdp: 'v=0\r\nm=video 9 UDP\r\n' } }, 'POST'), /voice/);
  await f.calls.handle('buyer', `${path}/signals`, { type: 'offer', clientId: 'offer', payload: { type: 'offer', sdp: 'v=0\r\nm=audio 9 UDP\r\n' } }, 'POST');
  await f.calls.handle('buyer', `${path}/connected`, {}, 'POST'); assert.equal((await f.store.get(`voiceCalls/${call.id}`)).connectedAt, null);
  await f.calls.handle('seller', `${path}/connected`, {}, 'POST'); assert.ok((await f.store.get(`voiceCalls/${call.id}`)).connectedAt);
  f.tick(46000); const ended = await f.calls.handle('buyer', `${path}/expire`, {}, 'POST'); assert.equal(ended.call.status, 'ended'); assert.equal((await f.store.query(`voiceCalls/${call.id}/signals`)).length, 0); assert.equal((await f.store.get('callState/seller')).callId, null);
  assert.equal((await f.store.query(`conversations/${conversation.id}/messages`)).length, 1);
});
test('Call summaries preserve unread messages until the recipient opens the conversation', async () => {
  const f = fixture(); const { conversation } = await f.chat.handle('buyer', '/conversations', { recipientId: 'seller' }, 'POST');
  const path = `/conversations/${conversation.id}`;
  await f.chat.handle('seller', `${path}/messages`, { text: 'Unread reply', clientId: 'reply' }, 'POST');
  const { call } = await f.calls.handle('buyer', '/calls', { conversationId: conversation.id, clientId: 'unread-call' }, 'POST');
  await f.calls.handle('buyer', `/calls/${call.id}/end`, { reason: 'hangup' }, 'POST');
  const afterCall = await f.store.get(`conversations/${conversation.id}`);
  assert.equal(afterCall.seq, 2); assert.deepEqual(afterCall.readBy, { buyer: 0, seller: 1 });
  await f.chat.handle('buyer', `${path}/read`, { throughSeq: 2 }, 'POST');
  assert.equal((await f.store.get(`conversations/${conversation.id}`)).readBy.buyer, 2);
});
test('Government ID review is private, immutable while pending, rejects self-review and cleans photos', async () => {
  const f = fixture(); const submit = await f.account({ uid: 'buyer' }, '/verification/id', { idType: 'National ID', fullName: 'buyer User', photo: png, consent: true }, 'POST'); assert.equal(submit.account.verification.status, 'pending');
  const saved = await f.store.get('verifications/buyer');
  await assert.rejects(f.account({ uid: 'buyer' }, '/verification/id', { idType: 'National ID', fullName: 'buyer User', photo: png, consent: true }, 'POST'), /already/);
  await assert.rejects(f.account({ uid: 'outsider' }, '/verification/reviews/buyer', {}, 'GET'), /Reviewer/);
  f.rows.set('roles/buyer', { reviewer: true }); await assert.rejects(f.account({ uid: 'buyer' }, '/verification/reviews/buyer', {}, 'GET'), /own ID/);
  await assert.rejects(f.account({ uid: 'reviewer' }, '/verification/reviews/buyer', { decision: 'verified', submissionId: 'wrong' }, 'POST'), /changed/);
  const approved = await f.account({ uid: 'reviewer' }, '/verification/reviews/buyer', { decision: 'verified', submissionId: saved.submissionId }, 'POST'); assert.equal(approved.account.verification.status, 'verified'); assert.equal((await f.store.get('verifications/buyer')).photoPath, null); assert.ok(f.deleted.includes(saved.photoPath));
  await f.account({ uid: 'buyer', record: { email: 'buyer@example.invalid' } }, '/auth/me', { fullName: 'New Name', phone: '09123456789', city: 'Tagum City' }, 'PATCH'); assert.equal((await f.accounts.account('buyer')).verification.status, 'unverified');
});
test('Email changes require recent password confirmation and only change the verified caller', async () => {
  const f = fixture(); const session = { uid: 'buyer', record: { email: 'buyer@example.invalid' }, authTime: Date.parse('2026-10-02T04:00:00Z') / 1000 };
  await assert.rejects(f.account({ ...session, authTime: session.authTime - 301 }, '/auth/email', { email: 'new@example.invalid' }, 'POST'), /password/);
  await f.account(session, '/auth/email', { email: 'NEW@example.invalid', uid: 'seller' }, 'POST');
  assert.equal((await f.accounts.account('buyer')).personal.email, 'new@example.invalid'); assert.equal((await f.accounts.account('seller')).personal.email, 'seller@example.invalid'); assert.equal(f.authChanges[0].localId, 'buyer');
});
test('personal address saves retain legacy values and reject invalid locality and postal code', async () => {
  const f = fixture(); const session = { uid: 'buyer', record: { email: 'buyer@example.invalid' } };
  f.rows.get('users/buyer').personal.city = '';
  const personal = { fullName: 'buyer User', phone: '09123456789', city: 'Tagum City', street: 'Purok 2', barangay: 'Visayan Village', postalCode: '8100' };
  const saved = await f.account(session, '/auth/me', personal, 'PATCH');
  assert.equal(saved.account.personal.street, 'Purok 2'); assert.equal(saved.account.personal.barangay, 'Visayan Village');
  const contact = await f.account(session, '/auth/me', { fullName: personal.fullName, phone: '09987654321', city: personal.city }, 'PATCH');
  assert.equal(contact.account.personal.postalCode, '8100'); assert.equal(contact.account.personal.street, 'Purok 2');
  await assert.rejects(f.account(session, '/auth/me', { ...personal, city: 'Davao City' }, 'PATCH'), /locality/);
  await assert.rejects(f.account(session, '/auth/me', { ...personal, postalCode: 'abcd' }, 'PATCH'), /postal/);
  assert.equal((await f.store.get('directory/buyer')).city, personal.city);
});
test('Maintenance expires pending IDs and deletes orphan media without touching referenced photos', async () => {
  const f = fixture(); await f.account({ uid: 'buyer' }, '/verification/id', { idType: 'National ID', fullName: 'buyer User', photo: png, consent: true }, 'POST');
  const idPhoto = (await f.store.get('verifications/buyer')).photoPath;
  await f.commerce('buyer', '/uploads', { kind: 'listing', photo: png }, 'POST');
  f.rows.set('uploads/kept', { id: 'kept', ownerId: 'seller', kind: 'listing', refs: ['livestock'], expiresAt: null, publicId: 'animarket/seller/kept' });
  f.tick(31 * 86400000); const result = await f.maintenance(); assert.equal(result.ids, 1); assert.equal(result.uploads, 1); assert.ok(f.deleted.includes(idPhoto)); assert.ok(await f.store.get('uploads/kept')); assert.equal((await f.accounts.account('buyer')).verification.status, 'expired');
});
