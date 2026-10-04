// Explicit production probe: uses the app's account store, then removes only its own disposable accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');

if (!process.argv.includes('--live')) throw new Error('Pass --live to test the deployed registration flow.');
const adminOnly = process.argv.includes('--admin-only');
const registrationOnly = process.argv.includes('--registration-only');
const verificationRequirements = process.argv.includes('--verification-requirements');
const root = path.resolve(__dirname, '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  if (!line.startsWith('EXPO_PUBLIC_')) continue;
  const split = line.indexOf('=');
  process.env[line.slice(0, split)] = line.slice(split + 1).replace(/^['"]|['"]$/g, '');
}
assert.equal(process.env.EXPO_PUBLIC_BACKEND, 'firebase');
assert.equal(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, 'animarket-87354');
const run = randomUUID();
const manifestPath = path.join(root, 'backend-probe.local.json');
if (fs.existsSync(manifestPath)) throw new Error('Clean up the previous cloud probe before running another.');
const users = [];
const sdkAuth = require('firebase/auth');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  return resolve.call(this, name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name, parent, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === 'firebase/auth') return { ...sdkAuth, createUserWithEmailAndPassword: async (...values) => {
    assert.ok(values[1].startsWith(`registration-probe-${run}-`));
    const result = await sdkAuth.createUserWithEmailAndPassword(...values);
    users.push({ uid: result.user.uid, email: result.user.email });
    fs.writeFileSync(manifestPath, JSON.stringify({ run, users }, null, 2), { mode: 0o600 });
    return result;
  } };
  if (name === 'react-native') return { Platform: { OS: 'web' } };
  if (name === 'expo-constants') return { expoConfig: {} };
  if (name === 'expo-secure-store') return {};
  return load.call(this, name, ...args);
};
async function until(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Firebase account state did not settle.');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function main() {
  const cliAuth = require('firebase-tools/lib/auth');
  const scopes = require('firebase-tools/lib/scopes');
  const owner = cliAuth.getProjectDefaultAccount(root);
  if (!owner) throw new Error('Firebase owner CLI sign-in is required to clean up test accounts.');
  const credential = await cliAuth.getAccessToken(owner.tokens.refresh_token, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
  async function google(url, method = 'GET', body) {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${credential.access_token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`Registration probe management failed (${response.status}).`);
    return response.json();
  }
  const billing = await google('https://cloudbilling.googleapis.com/v1/projects/animarket-87354/billingInfo');
  assert.equal(billing.billingEnabled, false); assert.ok(!billing.billingAccountName);
  const { createFirestore } = await import('../supabase/functions/animarket/firestore.mjs');
  const remote = createFirestore({ project: 'animarket-87354', accessToken: async () => credential.access_token });
  const { auth, firestore, app } = require('../src/services/firebase.ts').getFirebaseServices();
  const store = require('../src/features/profile/profile_store.ts');
  const { doc, getDoc } = require('firebase/firestore');
  const values = { firstName: 'Registration', middleName: '', lastName: 'Probe', email: `registration-probe-${run}-new@example.invalid`,
    phone: '09123456789', password: `Probe1!${run.slice(0, 8)}` };
  try {
    await store.initializeAccount();
    if (!adminOnly) {
    assert.equal(await store.registerAccount(values), null);
    assert.equal(store.getAccountSnapshot().signedIn, true);
    const uid = auth.currentUser.uid;
    const profile = (await getDoc(doc(firestore, 'users', uid))).data();
    assert.equal(profile.personal.email, values.email);
    assert.equal(profile.personal.city, ''); assert.equal(profile.street, ''); assert.equal(profile.postalCode, '');
    assert.equal((await getDoc(doc(firestore, 'directory', uid))).data().fullName, 'Registration Probe');
    const { cloudBackendRequest } = require('../src/services/supabase.ts');
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1sAAAAASUVORK5CYII=';
    const attemptedOrder = { order: { id: `verification_probe_${run}`, ownerId: uid, status: 'saved-locally', draft: { item: { id: 'unavailable' } } } };
    if (verificationRequirements) {
      await assert.rejects(store.submitIdentity('National ID', png), /Complete your address/);
      await assert.rejects(cloudBackendRequest('/verification/id', { idType: 'National ID', fullName: profile.personal.fullName, photo: png, consent: true }), (error) => error.status === 409 && /Personal Information/.test(error.message));
      assert.equal((await getDoc(doc(firestore, 'verifications', uid))).exists(), false);
      await assert.rejects(cloudBackendRequest('/orders/save', attemptedOrder), (error) => error.status === 403 && /ID approval/.test(error.message));
    }
    const personal = { ...store.getAccountSnapshot().personal, city: 'Tagum City', street: 'Purok 2', barangay: 'Visayan Village', postalCode: '8100' };
    assert.equal(await store.savePersonalInformation(personal), null);
    const addressed = (await getDoc(doc(firestore, 'users', uid))).data();
    assert.equal(addressed.street, personal.street); assert.equal(addressed.barangay, personal.barangay); assert.equal(addressed.postalCode, personal.postalCode);
    if (verificationRequirements) {
      assert.equal((await store.submitIdentity('National ID', png)).verification.status, 'pending');
      await assert.rejects(cloudBackendRequest('/orders/save', attemptedOrder), (error) => error.status === 403 && /ID approval/.test(error.message));
      assert.equal((await remote.get(`orders/${attemptedOrder.order.id}`)), null);
      assert.equal((await store.withdrawIdentity()).verification.status, 'unverified');
      console.log('Live missing-address ID denial, address completion, pending ID submission and unverified/pending order denial passed. Test ID withdrawn.');
    }
    const { profile: publicProfile } = await require('../src/services/supabase.ts').cloudBackendRequest(`/users/${uid}`);
    assert.equal(publicProfile.purok, personal.street); assert.equal(publicProfile.barangay, personal.barangay); assert.equal(publicProfile.city, personal.city);
    assert.equal(Object.hasOwn(publicProfile, 'postalCode'), false);
    store.signOut(); await until(() => auth.currentUser === null);
    assert.match(await store.registerAccount({ ...values, password: 'DifferentPass2!' }), /email already has an account/);
    assert.equal(store.getAccountSnapshot().signedIn, false);
    assert.match(await store.registerAccount(values), /already registered/);
    await until(() => auth.currentUser === null);
    assert.equal(await store.signIn(values.email, values.password), null);
    assert.equal(store.getAccountSnapshot().userId, uid);
    assert.equal(store.getAccountSnapshot().personal.street, personal.street); assert.equal(store.getAccountSnapshot().personal.barangay, personal.barangay);
    store.signOut(); await until(() => auth.currentUser === null);
    console.log('Live app registration without an address, later address saving, profile address, duplicate-email feedback, login and logout passed.');

    const incomplete = { ...values, email: `registration-probe-${run}-repair@example.invalid` };
    const { user } = await require('firebase/auth').createUserWithEmailAndPassword(auth, incomplete.email, incomplete.password);
    store.signOut(); await until(() => auth.currentUser === null);
    assert.equal(await store.registerAccount(incomplete), null);
    assert.equal(store.getAccountSnapshot().userId, user.uid);
    console.log('Live interrupted-registration recovery passed without creating a second account.');
    store.signOut(); await until(() => auth.currentUser === null);
    }
    if (!registrationOnly) {
    const savedLogin = fs.readFileSync(path.join(root, 'admin-login.local.txt'), 'utf8');
    const credentialValue = (label) => savedLogin.match(new RegExp(`^${label}: (.+)$`, 'm'))?.[1].trim();
    assert.equal(await store.signIn(credentialValue('Email'), credentialValue('Password')), null);
    assert.equal(store.getAccountSnapshot().userId, credentialValue('UID'));
    assert.equal(store.getAccountSnapshot().isStaff, true);
    assert.equal(store.getAccountSnapshot().isReviewer, true);
    assert.equal((await getDoc(doc(firestore, 'users', auth.currentUser.uid))).exists(), false);
    assert.equal(require('../src/navigation/login_destination.ts').loginDestination('/messages', true), '/admin');
    const { cloudBackendRequest } = require('../src/services/supabase.ts');
    assert.ok(Array.isArray((await cloudBackendRequest('/verification/reviews')).reviews));
    await assert.rejects(cloudBackendRequest('/uploads', {}, undefined, 'POST'), (error) => error.status === 403);
    console.log('Live app admin login, staff-only destination, private review queue and customer-action denial passed. No admin or customer records changed.');
    }
  } finally {
    store.signOut(); await until(() => auth.currentUser === null);
    try {
      for (const { uid, email } of users) {
        assert.ok(email.startsWith(`registration-probe-${run}-`));
        const saved = await remote.get(`users/${uid}`);
        if (saved) assert.equal(saved.personal.email, email);
        const review = await remote.get(`verifications/${uid}`);
        if (review?.photoPath) {
          assert.equal(await store.signIn(email, values.password), null);
          await store.withdrawIdentity(); store.signOut(); await until(() => auth.currentUser === null);
        }
        await google('https://identitytoolkit.googleapis.com/v1/projects/animarket-87354/accounts:delete', 'POST', { localId: uid });
        await remote.transact(async (tx) => { for (const collection of ['users', 'directory', 'roles', 'verifications']) tx.delete(`${collection}/${uid}`); });
      }
      if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
      console.log(users.length ? 'All disposable registration accounts and records removed. Billing remains disabled.' : 'Read-only admin probe signed out. Billing remains disabled.');
    } finally { await require('firebase/app').deleteApp(app); }
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Registration probe failed.'); process.exitCode = 1; });
