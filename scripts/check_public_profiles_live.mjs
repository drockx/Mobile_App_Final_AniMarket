// This explicit live check creates two disposable accounts and removes only its own records.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { createFirestore } from '../supabase/functions/animarket/firestore.mjs';

if (!process.argv.includes('--live')) throw new Error('Use --live after deploying the profile backend.');
const root = path.resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/).filter((line) => /^EXPO_PUBLIC_/.test(line)).map((line) => {
  const split = line.indexOf('='); return [line.slice(0, split), line.slice(split + 1).replace(/^['"]|['"]$/g, '')];
}));
const config = { apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY, projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, appId: env.EXPO_PUBLIC_FIREBASE_APP_ID };
assert.equal(config.projectId, 'animarket-87354'); assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, 'https://yvamvsbfbknnasfvqdto.supabase.co');
const manifestPath = path.join(root, 'public-profiles-probe.local.json');
if (fs.existsSync(manifestPath)) throw new Error('Clean up the earlier profile test before running another.');
const auth = require('firebase-tools/lib/auth'), scopes = require('firebase-tools/lib/scopes');
const owner = auth.getProjectDefaultAccount(root);
if (!owner) throw new Error('Firebase owner sign-in is required.');
const credentials = await auth.getAccessToken(owner.tokens.refresh_token, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
const store = createFirestore({ project: config.projectId, accessToken: async () => credentials.access_token });
async function google(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${credentials.access_token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  if (!response.ok && response.status !== 404) throw new Error(`Test account management failed (${response.status}).`);
  return response.status === 404 || response.status === 204 ? {} : response.json();
}
const billing = await google(`https://cloudbilling.googleapis.com/v1/projects/${config.projectId}/billingInfo`);
assert.equal(billing.billingEnabled, false); assert.ok(!billing.billingAccountName);
const run = randomUUID(), users = [], apps = [];
const manifest = () => fs.writeFileSync(manifestPath, JSON.stringify({ run, users }, null, 2), { mode: 0o600 });
async function user(label) {
  const app = initializeApp(config, `profile-probe-${run}-${label}`); apps.push(app);
  const firestore = getFirestore(app), email = `profile-probe-${run}-${label}@example.invalid`.toLowerCase();
  const { user: person } = await createUserWithEmailAndPassword(getAuth(app), email, `Probe1!${run.slice(0, 8)}`);
  users.push({ uid: person.uid, email }); manifest();
  const personal = { fullName: `Disposable ${label}`, email, phone: '09123456789', city: 'Tagum City' };
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, 'users', person.uid), { id: person.uid, username: personal.fullName, personal, acceptedTerms: true, createdAt: new Date().toISOString(), avatar: null });
  batch.set(doc(firestore, 'directory', person.uid), { id: person.uid, fullName: personal.fullName, nameLower: personal.fullName.toLowerCase(), city: personal.city });
  await batch.commit();
  return { uid: person.uid, firestore, async request(path, body, method = body ? 'POST' : 'GET') {
    const response = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/animarket`, { method: 'POST', headers: { apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${await person.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ path, body, method }), signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error ?? 'Profile test failed.'), { status: response.status });
    return result;
  } };
}
manifest();
try {
  const first = await user('First'), second = await user('Second');
  const target = `/users/${second.uid}`;
  const { profile } = await first.request(target);
  assert.equal(profile.id, second.uid); assert.equal(profile.rating.average, null); assert.equal(profile.canRate, true);
  assert.equal(profile.email, users.find((person) => person.uid === second.uid)?.email); assert.equal(profile.phone, '09123456789');
  assert.equal(profile.purok, ''); assert.equal(profile.barangay, '');
  for (const key of ['personal', 'street', 'postalCode', 'verification', 'photoPath']) assert.equal(Object.hasOwn(profile, key), false);
  await assert.rejects(getDoc(doc(first.firestore, 'users', second.uid)), (error) => error.code === 'permission-denied');
  await assert.rejects(setDoc(doc(first.firestore, 'ratingSummaries', second.uid), { count: 100, sum: 500 }), (error) => error.code === 'permission-denied');
  const saved = (await first.request(`${target}/rating`, { stars: 5 })).profile;
  assert.deepEqual(saved.rating, { count: 1, average: 5 }); assert.equal(saved.myRating, 5);
  await first.request(`${target}/rating`, { stars: 5 });
  const changed = (await first.request(`${target}/rating`, { stars: 3 })).profile;
  assert.deepEqual(changed.rating, { count: 1, average: 3 });
  await second.request(`/users/${first.uid}/rating`, { stars: 4 });
  assert.deepEqual((await first.request(`/users/${first.uid}`)).profile.rating, { count: 1, average: 4 });
  const readBack = (await first.request(target)).profile;
  assert.deepEqual(readBack.rating, { count: 1, average: 3 }); assert.equal(readBack.myRating, 3);
  assert.equal((await second.request(target)).profile.canRate, false);
  await assert.rejects(second.request(`${target}/rating`, { stars: 5 }), (error) => error.status === 403);
  await assert.rejects(first.request(`${target}/rating`, { stars: 6 }), (error) => error.status === 400);
  const denied = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/animarket`, { method: 'POST', headers: { apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: target, method: 'GET' }) });
  assert.equal(denied.status, 401);
  console.log('Live public profiles, mutual ratings, persistence, edits, duplicate prevention and private-data protection passed.');
} finally {
  let cleaned = false;
  try {
    const paths = new Set();
    for (const { uid, email } of users) {
      assert.ok(email.startsWith(`profile-probe-${run}-`));
      const record = await store.get(`users/${uid}`); if (record) assert.equal(record.personal.email, email);
      for (const name of ['users', 'directory', 'ratingSummaries']) paths.add(`${name}/${uid}`);
      for (const rater of users) paths.add(`userRatings/${uid}/raters/${rater.uid}`);
      await google(`https://identitytoolkit.googleapis.com/v1/projects/${config.projectId}/accounts:delete`, 'POST', { localId: uid });
    }
    await store.transact(async (tx) => { for (const key of paths) tx.delete(key); });
    for (const key of paths) assert.equal(await store.get(key), null);
    cleaned = true; console.log('Disposable profile-test accounts and rating records removed. Firebase billing remains disabled.');
  } finally { await Promise.allSettled(apps.map((app) => deleteApp(app))); if (cleaned) fs.unlinkSync(manifestPath); }
}
