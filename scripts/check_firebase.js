const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, collection, getDocs, writeBatch, connectFirestoreEmulator, setLogLevel } = require('firebase/firestore');
const { connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } = require('firebase/auth');
const { deleteApp } = require('firebase/app');
setLogLevel('silent');

// Never run these account writes against the real project.
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Run check:firebase through the local emulators.');
process.env.EXPO_PUBLIC_BACKEND = 'firebase';
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'demo-test-key';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'demo-animarket';
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'demo-animarket.firebaseapp.com';
process.env.EXPO_PUBLIC_FIREBASE_APP_ID = 'demo-animarket-app';
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  return resolve.call(this, name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2)) : name, parent, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const load = Module._load;
let cloudRequest;
Module._load = function (name, ...args) {
  if (name === './supabase' && args[0]?.filename?.endsWith('firebase_account.ts')) return { cloudBackendRequest: (...values) => cloudRequest(...values) };
  if (name === 'react-native') return { Platform: { OS: 'web' } };
  if (name === 'expo-constants') return { expoConfig: {} };
  if (name === 'expo-secure-store') {
    const unexpected = () => { throw new Error('Firebase must not use a second session store.'); };
    return { getItemAsync: unexpected, setItemAsync: unexpected, deleteItemAsync: unexpected };
  }
  return load.call(this, name, ...args);
};
async function until(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Account state did not settle in time.');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
const { getFirebaseServices } = require('../src/services/firebase.ts');
const { firebaseAccountRequest: request, readFirebaseAccount } = require('../src/services/firebase_account.ts');
const profile = (id, fullName = 'Owner User') => ({ id, username: fullName, personal: { fullName, email: `${id}@example.com`, phone: '09123456789', city: 'Tagum City' }, acceptedTerms: true, createdAt: new Date().toISOString(), avatar: null });
let checks = 0;
async function allowed(promise) { await assertSucceeds(promise); checks++; }
async function denied(promise) { await assertFails(promise); checks++; }

(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-animarket', firestore: { rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8') } });
  const { auth, firestore, app } = getFirebaseServices();
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(firestore, host, Number(port));
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const { createFirestore } = await import('../supabase/functions/animarket/firestore.mjs');
  const { createAccounts } = await import('../supabase/functions/animarket/records.mjs');
  const { createAccountActions } = await import('../supabase/functions/animarket/account_actions.mjs');
  const store = createFirestore({ project: 'demo-animarket', origin: `http://${process.env.FIRESTORE_EMULATOR_HOST}`, accessToken: async () => 'owner' });
  const accountActions = createAccountActions({ store, accounts: createAccounts({ store }), media: { privateDelete: async () => {} }, authAdmin: async (_action, body) => {
    const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/projects/demo-animarket/accounts:update`, { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error('Emulator email update failed.'); return response.json();
  } });
  cloudRequest = async (path, body, _signal, method = body ? 'POST' : 'GET') => accountActions({ uid: auth.currentUser.uid, record: { email: auth.currentUser.email }, authTime: (await auth.currentUser.getIdTokenResult()).claims.auth_time }, path, body, method);
  try {
    const owner = env.authenticatedContext('owner', { email: 'owner@example.com' }).firestore();
    const other = env.authenticatedContext('other', { email: 'other@example.com' }).firestore();
    const anonymous = env.unauthenticatedContext().firestore();
    await allowed(setDoc(doc(owner, 'users', 'owner'), profile('owner')));
    await denied(setDoc(doc(owner, 'users', 'other'), profile('other')));
    await allowed(getDoc(doc(owner, 'users', 'owner')));
    await denied(getDoc(doc(other, 'users', 'owner')));
    await denied(getDoc(doc(anonymous, 'users', 'owner')));
    await denied(getDocs(collection(owner, 'users')));
    await denied(updateDoc(doc(owner, 'users', 'owner'), { isReviewer: true }));
    await denied(updateDoc(doc(owner, 'users', 'owner'), { verification: { status: 'verified' } }));
    await denied(updateDoc(doc(owner, 'users', 'owner'), { avatar: { url: 'https://attacker.example/id.jpg', version: 'invented' } }));
    await denied(updateDoc(doc(owner, 'users', 'owner'), { createdAt: 'changed' }));
    await denied(updateDoc(doc(owner, 'users', 'owner'), { 'personal.email': 'another@example.com' }));
    await denied(setDoc(doc(other, 'users', 'other'), { ...profile('other'), personal: { ...profile('other').personal, city: 'Manila' } }));
    await denied(setDoc(doc(other, 'users', 'other'), { ...profile('other'), acceptedTerms: false }));
    await denied(setDoc(doc(owner, 'roles', 'owner'), { reviewer: true }));
    await allowed(getDoc(doc(owner, 'roles', 'owner')));
    await denied(getDoc(doc(other, 'roles', 'owner')));
    await denied(setDoc(doc(owner, 'verifications', 'owner'), { status: 'verified' }));
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'roles', 'reviewer'), { reviewer: true });
      await setDoc(doc(context.firestore(), 'verifications', 'owner'), { status: 'pending', fullName: 'Owner User' });
    });
    await allowed(getDoc(doc(owner, 'verifications', 'owner')));
    await denied(getDoc(doc(other, 'verifications', 'owner')));
    const reviewer = env.authenticatedContext('reviewer', { email: 'reviewer@example.com' }).firestore();
    await allowed(getDocs(collection(reviewer, 'verifications')));
    await denied(getDocs(collection(owner, 'verifications')));
    await denied(setDoc(doc(reviewer, 'verifications', 'owner'), { status: 'verified' }));
    await allowed(setDoc(doc(owner, 'directory', 'owner'), { id: 'owner', fullName: 'Owner User', nameLower: 'owner user', city: 'Tagum City' }));
    await allowed(getDoc(doc(other, 'directory', 'owner')));
    await denied(getDoc(doc(anonymous, 'directory', 'owner')));
    await denied(setDoc(doc(owner, 'directory', 'owner'), { id: 'owner', fullName: 'Fake Name', nameLower: 'fake name', city: 'Tagum City' }));
    await denied(setDoc(doc(owner, 'directory', 'owner'), { id: 'owner', fullName: 'Owner User', nameLower: 'owner user', city: 'Tagum City', email: 'owner@example.com' }));
    const batch = writeBatch(owner); const edited = { ...profile('owner', 'Updated Owner'), createdAt: (await getDoc(doc(owner, 'users', 'owner'))).data().createdAt };
    batch.set(doc(owner, 'users', 'owner'), edited);
    batch.set(doc(owner, 'directory', 'owner'), { id: 'owner', fullName: 'Updated Owner', nameLower: 'updated owner', city: 'Tagum City' });
    await denied(batch.commit());
    await denied(setDoc(doc(owner, 'unknown_collection', 'record'), { ownerId: 'owner' }));
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'listings', 'active'), { id: 'active', status: 'active', seller: { id: 'owner' } });
      await setDoc(doc(db, 'listings', 'paused'), { id: 'paused', status: 'paused', seller: { id: 'owner' } });
      await setDoc(doc(db, 'listingPrivate', 'active'), { pin: { latitude: 7, longitude: 125 } });
      await setDoc(doc(db, 'orders', 'one'), { participants: ['owner', 'other'] });
      await setDoc(doc(db, 'conversations', 'one'), { participants: ['owner', 'other'] });
      await setDoc(doc(db, 'conversations', 'one', 'messages', 'one'), { text: 'Private message' });
      await setDoc(doc(db, 'voiceCalls', 'one'), { participants: ['owner', 'other'] });
      await setDoc(doc(db, 'voiceCalls', 'one', 'signals', 'one'), { toUid: 'other', payload: 'Private signal' });
    });
    await allowed(getDoc(doc(anonymous, 'listings', 'active'))); await denied(getDoc(doc(anonymous, 'listings', 'paused')));
    await allowed(getDoc(doc(owner, 'listings', 'paused'))); await denied(getDoc(doc(other, 'listings', 'paused')));
    await denied(getDoc(doc(owner, 'listingPrivate', 'active'))); await denied(setDoc(doc(owner, 'listings', 'forged'), { status: 'active' }));
    await allowed(getDoc(doc(owner, 'orders', 'one'))); await denied(getDoc(doc(reviewer, 'orders', 'one')));
    await allowed(getDoc(doc(other, 'conversations', 'one', 'messages', 'one'))); await denied(getDoc(doc(reviewer, 'conversations', 'one', 'messages', 'one')));
    await denied(setDoc(doc(owner, 'conversations', 'one', 'messages', 'forged'), { text: 'Forged' }));
    await allowed(getDoc(doc(other, 'voiceCalls', 'one', 'signals', 'one'))); await denied(getDoc(doc(owner, 'voiceCalls', 'one', 'signals', 'one')));
    await denied(getDoc(doc(reviewer, 'voiceCalls', 'one'))); await denied(setDoc(doc(owner, 'callState', 'owner'), { callId: 'forged' }));
    await allowed(setDoc(doc(owner, 'users', 'owner', 'notificationReads', 'event'), { id: 'event', eventId: 'event', ownerId: 'owner' }));
    await denied(getDoc(doc(other, 'users', 'owner', 'notificationReads', 'event')));
    console.log(`Account security rules: ${checks} access checks passed.`);

    const body = { fullName: 'Actual SDK User', email: `sdk-${Date.now()}@example.com`, phone: '09123456789', city: 'Tagum City', acceptedTerms: true, password: 'StrongPass1!' };
    await assert.rejects(request('/auth/register', { method: 'POST', body: { ...body, password: 'weak' } }), /8–21/);
    assert.equal(auth.currentUser, null);
    const session = await request('/auth/register', { method: 'POST', body });
    assert.equal(session.account.personal.email, body.email);
    assert.equal(session.account.isReviewer, false); assert.equal(session.account.verification.status, 'unverified');
    const token = session.token;
    const saved = (await getDoc(doc(firestore, 'users', session.account.id))).data();
    assert.equal(Object.hasOwn(saved, 'password'), false);
    assert.equal((await readFirebaseAccount()).id, session.account.id);
    await assert.rejects(request('/auth/me', { token: 'firebase:another-account' }), /account changed/);
    await request('/auth/logout', { method: 'POST', token }); assert.equal(auth.currentUser, null);
    await assert.rejects(request('/auth/register', { method: 'POST', body: { ...body, password: 'DifferentPass2!' } }), (error) => error.status === 409 && /email already has an account/.test(error.message));
    assert.equal(auth.currentUser, null);
    await assert.rejects(request('/auth/register', { method: 'POST', body }), /already registered/);
    assert.equal((await getDoc(doc(firestore, 'users', session.account.id))).data().personal.fullName, body.fullName);
    await request('/auth/logout', { method: 'POST', token });
    await assert.rejects(request('/auth/login', { method: 'POST', body: { email: body.email, password: 'WrongPass1!' } }), /incorrect/);
    const loggedIn = await request('/auth/login', { method: 'POST', body }); assert.equal(loggedIn.account.id, session.account.id);
    const personal = { ...body, fullName: 'Updated SDK User', phone: '09987654321' };
    const updated = await request('/auth/me', { method: 'PATCH', token, body: personal });
    assert.equal(updated.account.personal.fullName, personal.fullName); assert.equal(updated.account.personal.phone, personal.phone);
    const nextEmail = `changed-${Date.now()}@example.com`;
    const changedEmail = await request('/auth/me', { method: 'PATCH', token, body: { ...personal, email: nextEmail, currentPassword: body.password } });
    assert.equal(changedEmail.account.personal.email, nextEmail); body.email = nextEmail; personal.email = nextEmail;
    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), 'verifications', session.account.id), { status: 'verified', fullName: personal.fullName }));
    assert.equal((await readFirebaseAccount()).verification.status, 'verified');
    const renamed = await request('/auth/me', { method: 'PATCH', token, body: { ...personal, fullName: 'Changed After Review' } });
    assert.equal(renamed.account.verification.status, 'unverified');
    await assert.rejects(request('/verification/eligibility', { token }), /government/);
    await request('/auth/password', { method: 'POST', token, body: { current: body.password, next: 'NextStrong2!' } });
    await request('/auth/logout', { method: 'POST', token });
    await assert.rejects(request('/auth/login', { method: 'POST', body }), /incorrect/);
    await request('/auth/login', { method: 'POST', body: { ...body, password: 'NextStrong2!' } });
    await deleteUser(auth.currentUser);
    console.log('Firebase SDK account flows passed: strength, registration, private profile, restore, ownership, login/logout, updates, approval invalidation and password changes.');

    const store = require('../src/features/profile/profile_store.ts');
    await store.initializeAccount();
    assert.equal(store.getAccountSnapshot().signedIn, false);
    const values = { firstName: 'Store', middleName: '', lastName: 'User', email: `store-${Date.now()}@example.com`, phone: '09123456789', municipalityCity: 'Tagum City', purok: 'Purok 1', barangay: 'Magugpo', postalCode: '8100', password: 'StorePass1!' };
    assert.equal(await store.registerAccount(values), null);
    const storeUid = auth.currentUser.uid;
    assert.equal(store.getAccountSnapshot().userId, storeUid);
    await store.retryInitializeAccount();
    assert.equal(store.getAccountSnapshot().signedIn, true);
    store.signOut(); await until(() => auth.currentUser === null);
    const cancelled = store.signIn(values.email, values.password);
    store.signOut();
    assert.match(await cancelled, /cancelled/);
    await until(() => auth.currentUser === null);
    assert.equal(store.getAccountSnapshot().signedIn, false);
    const [older, failedNewer] = await Promise.all([store.signIn(values.email, values.password), store.signIn(values.email, 'WrongPass2!')]);
    assert.match(older, /cancelled/); assert.match(failedNewer, /incorrect/);
    await until(() => auth.currentUser === null);
    assert.equal(store.getAccountSnapshot().signedIn, false);
    const [failedOlder, newer] = await Promise.all([store.signIn(values.email, 'WrongPass2!'), store.signIn(values.email, values.password)]);
    assert.match(failedOlder, /incorrect/); assert.equal(newer, null);
    assert.equal(store.getAccountSnapshot().userId, storeUid);
    store.signOut(); await until(() => auth.currentUser === null);
    const incomplete = { ...values, email: `repair-${Date.now()}@example.com` };
    await createUserWithEmailAndPassword(auth, incomplete.email, incomplete.password);
    await store.retryInitializeAccount();
    assert.match(store.getAccountSnapshot().error, /profile is incomplete/);
    store.dismissAccountError();
    assert.equal(await store.registerAccount(incomplete), null);
    assert.equal(store.getAccountSnapshot().personal.email, incomplete.email);
    await deleteUser(auth.currentUser);
    await until(() => !store.getAccountSnapshot().signedIn);
    // Also repair an Auth-only account after logout, without duplicating it.
    await createUserWithEmailAndPassword(auth, `repair-out-${Date.now()}@example.com`, values.password);
    const repairEmail = auth.currentUser.email; const repairUid = auth.currentUser.uid;
    store.signOut(); await until(() => auth.currentUser === null);
    assert.equal(await store.registerAccount({ ...values, email: repairEmail }), null);
    assert.equal(store.getAccountSnapshot().userId, repairUid);
    await deleteUser(auth.currentUser);
    await until(() => !store.getAccountSnapshot().signedIn);
    console.log('App account store passed: bootstrap, registration, restore, logout during login, cancelled login followed by failure, latest-login selection and incomplete-profile recovery.');

    const staffEmail = `staff-${Date.now()}@example.com`;
    const staffUser = (await createUserWithEmailAndPassword(auth, staffEmail, values.password)).user;
    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), 'roles', staffUser.uid), { staff: true, reviewer: true }));
    await store.retryInitializeAccount();
    assert.equal(store.getAccountSnapshot().isStaff, true);
    assert.equal(store.getAccountSnapshot().isReviewer, true);
    assert.equal((await getDoc(doc(firestore, 'users', staffUser.uid))).exists(), false);
    const { loginDestination } = require('../src/navigation/login_destination.ts');
    assert.equal(loginDestination('/messages', true), '/admin');
    assert.equal(loginDestination('/admin', false), '/home');
    await assert.rejects(request('/auth/register', { method: 'POST', body: { ...body, email: staffEmail, password: values.password } }), /admin portal/);
    store.signOut(); await until(() => auth.currentUser === null);
    assert.equal(await store.signIn(staffEmail, values.password), null);
    assert.equal(store.getAccountSnapshot().isStaff, true);
    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), 'roles', staffUser.uid), { staff: true, reviewer: false }));
    await until(() => !store.getAccountSnapshot().signedIn && auth.currentUser === null);
    assert.match(await store.signIn(staffEmail, values.password), /Admin access is no longer available/);
    await until(() => auth.currentUser === null);
    await signInWithEmailAndPassword(auth, staffEmail, values.password);
    await deleteUser(auth.currentUser);
    console.log('App admin login, profile-free staff identity, protected destination, registration denial and live role revocation passed.');
  } finally { await deleteApp(app); await env.cleanup(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
