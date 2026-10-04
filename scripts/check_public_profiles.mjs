import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccounts } from '../supabase/functions/animarket/records.mjs';
import { createPublicProfiles } from '../supabase/functions/animarket/public_profiles.mjs';
import { authorizeAction } from '../supabase/functions/animarket/session_access.mjs';

function fixture() {
  const rows = new Map(); let queue = Promise.resolve();
  const clone = (value) => value == null ? null : structuredClone(value);
  const get = async (path) => clone(rows.get(path));
  const store = { get, transact(action) {
    const task = queue.catch(() => {}).then(async () => {
      const writes = [];
      const value = await action({ get, set: (path, row) => writes.push([path, clone(row)]) });
      writes.forEach(([path, row]) => rows.set(path, row)); return value;
    }); queue = task; return task;
  } };
  for (const uid of ['seller', 'buyer', 'another']) rows.set(`users/${uid}`, {
    id: uid, personal: { fullName: `${uid} User`, city: 'Tagum City', email: `${uid}@example.invalid`, phone: '09123456789' },
    acceptedTerms: true, createdAt: '2026-10-01T00:00:00Z', street: 'Purok 2', barangay: 'Visayan Village', postalCode: '8100',
    avatar: { url: 'https://res.cloudinary.com/dnbmd5qhj/image/upload/profile.png', publicId: 'private-metadata' },
  });
  rows.set('verifications/seller', { status: 'verified', fullName: 'seller User', idType: 'National ID', photoPath: 'private/id.jpg', reason: 'Private' });
  const accounts = createAccounts({ store });
  const handle = createPublicProfiles({ store, accounts, now: () => Date.parse('2026-10-02T04:00:00Z') });
  const read = (viewer, target = 'seller') => handle({ uid: viewer }, `/users/${target}`, {}, 'GET');
  const rate = (viewer, stars, target = 'seller', patch = {}) => handle({ uid: viewer }, `/users/${target}/rating`, { stars, ...patch }, 'POST');
  return { rows, read, rate, handle };
}

test('Profiles expose only public fields, genuine verification, photos and rating summaries', async () => {
  const f = fixture(); const { profile } = await f.read('buyer');
  assert.deepEqual(Object.keys(profile).sort(), ['canRate', 'city', 'purok', 'barangay', 'email', 'fullName', 'id', 'memberSince', 'myRating', 'phone', 'photoUrl', 'rating', 'verified'].sort());
  assert.equal(profile.purok, 'Purok 2'); assert.equal(profile.barangay, 'Visayan Village');
  assert.equal(profile.email, 'seller@example.invalid'); assert.equal(profile.phone, '09123456789');
  assert.equal(profile.verified, true); assert.equal(profile.rating.average, null); assert.equal(profile.rating.count, 0);
  for (const privateValue of ['8100', 'private-metadata', 'private/id.jpg', 'National ID']) assert.equal(JSON.stringify(profile).includes(privateValue), false);
  assert.equal(Object.hasOwn(profile, 'street'), false); assert.equal(Object.hasOwn(profile, 'postalCode'), false);
  assert.equal((await f.read('seller', 'buyer')).profile.verified, false);
  f.rows.get('users/seller').personal.fullName = 'Changed name';
  assert.equal((await f.read('buyer')).profile.verified, false);
});

test('Both users can rate each other; edits and retries count each person once', async () => {
  const f = fixture();
  let result = (await f.rate('buyer', 5)).profile;
  assert.deepEqual(result.rating, { count: 1, average: 5 }); assert.equal(result.myRating, 5);
  await f.rate('buyer', 5); await f.rate('buyer', 3);
  result = (await f.rate('another', 4)).profile;
  assert.deepEqual(result.rating, { count: 2, average: 3.5 }); assert.equal(result.myRating, 4);
  assert.equal((await f.read('buyer')).profile.myRating, 3);
  assert.deepEqual((await f.rate('seller', 2, 'buyer')).profile.rating, { count: 1, average: 2 });
  assert.equal((await f.read('seller')).profile.canRate, false);
});

test('Concurrent ratings and edits retain accurate totals', async () => {
  const f = fixture(); await Promise.all([f.rate('buyer', 5), f.rate('another', 1)]);
  assert.deepEqual((await f.read('buyer')).profile.rating, { count: 2, average: 3 });
  await Promise.all([f.rate('buyer', 2), f.rate('buyer', 4)]);
  assert.deepEqual((await f.read('buyer')).profile.rating, { count: 2, average: 2.5 });
  assert.equal(f.rows.get('ratingSummaries/seller').sum, 5);
});

test('Reject self-ratings, invalid scores, missing users, staff access and account impersonation', async () => {
  const f = fixture(); const before = structuredClone([...f.rows]);
  await assert.rejects(f.rate('seller', 5), (error) => error.status === 403);
  for (const stars of [0, 6, 2.5, '5', null, NaN]) await assert.rejects(f.rate('buyer', stars), (error) => error.status === 400);
  await assert.rejects(f.read('buyer', 'missing'), (error) => error.status === 404);
  await assert.rejects(f.read('missing'), (error) => error.status === 409);
  await assert.rejects(f.handle({}, '/users/seller', {}, 'GET'), (error) => error.status === 401);
  await assert.rejects(f.handle({ uid: 'buyer', reviewOnly: true }, '/users/seller/rating', { stars: 5 }, 'POST'), (error) => error.status === 403);
  assert.throws(() => authorizeAction({ reviewOnly: true }, '/users/seller/rating'));
  assert.deepEqual([...f.rows], before);
  await f.rate('buyer', 4, 'seller', { raterId: 'another', userId: 'buyer', count: 100, sum: 500 });
  assert.equal(f.rows.has('userRatings/seller/raters/another'), false);
  assert.deepEqual(f.rows.get('ratingSummaries/seller'), { userId: 'seller', count: 1, sum: 4 });
  f.rows.set('roles/seller', { staff: true });
  await assert.rejects(f.read('buyer'), (error) => error.status === 404);
  assert.equal(await f.handle({ uid: 'buyer' }, '/unrelated', {}, 'GET'), undefined);
  await assert.rejects(f.handle({ uid: 'buyer' }, '/users/seller', {}, 'POST'), (error) => error.status === 405);
});
