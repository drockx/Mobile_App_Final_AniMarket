// Explicit live probes create disposable users and clean only their recorded resources.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, doc, getDoc, writeBatch, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { createFirestore, where as filter } from '../supabase/functions/animarket/firestore.mjs';

if (!process.argv.includes('--live')) throw new Error('Pass --live only after the cloud deployment is ready.');
const messagesOnly = process.argv.includes('--messages-only');
const includeCalls = messagesOnly && process.argv.includes('--calls');
const require = createRequire(import.meta.url); const root = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/).filter((line) => /^EXPO_PUBLIC_/.test(line)).map((line) => { const split = line.indexOf('='); return [line.slice(0, split), line.slice(split + 1).replace(/^['"]|['"]$/g, '')]; }));
const config = { apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY, projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, appId: env.EXPO_PUBLIC_FIREBASE_APP_ID, authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN };
assert.equal(config.projectId, 'animarket-87354'); assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, 'https://yvamvsbfbknnasfvqdto.supabase.co');
const manifestPath = path.join(root, 'backend-probe.local.json'); if (fs.existsSync(manifestPath)) throw new Error('An earlier cloud probe needs cleanup before another run.');
const run = randomUUID(); const resources = { run, users: [], documents: [], apps: [] }; const apps = []; const stops = [];
const manifest = () => fs.writeFileSync(manifestPath, JSON.stringify({ run, users: resources.users, documents: resources.documents }, null, 2), { mode: 0o600 });
const cliAuth = require('firebase-tools/lib/auth'); const scopes = require('firebase-tools/lib/scopes');
const owner = cliAuth.getProjectDefaultAccount(root); if (!owner) throw new Error('Firebase owner CLI sign-in is required.');
const credential = await cliAuth.getAccessToken(owner.tokens.refresh_token, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
const store = createFirestore({ project: config.projectId, accessToken: async () => credential.access_token });
async function google(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${credential.access_token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
  if (!response.ok && response.status !== 404) throw new Error(`Fixture management failed (${response.status}).`); return response.status === 404 || response.status === 204 ? {} : response.json();
}
const billing = await google('https://cloudbilling.googleapis.com/v1/projects/animarket-87354/billingInfo'); assert.equal(billing.billingEnabled, false); assert.ok(!billing.billingAccountName);
const cleanupToken = messagesOnly ? '' : fs.readFileSync(path.join(root, '.env.maintenance.local'), 'utf8').trim().split('=')[1];
async function cleanupRemote() {
  const response = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/animarket/maintenance`, { method: 'POST', headers: { 'x-maintenance-token': cleanupToken }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('Private fixture media cleanup needs retry.'); return response.json();
}
async function user(label) {
  const app = initializeApp(config, `cloud-probe-${run}-${label}`); apps.push(app); const auth = getAuth(app); const firestore = getFirestore(app);
  const email = `cloud-probe-${run}-${label}@example.invalid`.toLowerCase(); const password = `Probe1!${run.slice(0, 8)}`;
  const { user } = await createUserWithEmailAndPassword(auth, email, password); resources.users.push({ uid: user.uid, email }); manifest();
  await updateProfile(user, { displayName: `Cloud Probe ${label}` });
  const personal = { fullName: `Cloud Probe ${label}`, email, phone: '09123456789', city: 'Tagum City' };
  const batch = writeBatch(firestore); batch.set(doc(firestore, 'users', user.uid), { id: user.uid, username: personal.fullName, personal, acceptedTerms: true, createdAt: new Date().toISOString(), avatar: null });
  batch.set(doc(firestore, 'directory', user.uid), { id: user.uid, fullName: personal.fullName, nameLower: personal.fullName.toLowerCase(), city: personal.city });
  await batch.commit();
  return { uid: user.uid, user, personal, firestore, async request(path, body, method = body ? 'POST' : 'GET') {
    const response = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/animarket`, { method: 'POST', headers: { apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ path, body, method }), signal: AbortSignal.timeout(60000) });
    const data = await response.json(); if (!response.ok) throw Object.assign(new Error(data.error ?? 'Cloud action failed.'), { status: response.status }); return data;
  } };
}
function nextSnapshot(ref, predicate) {
  let stop; const promise = new Promise((resolve, reject) => { const timeout = setTimeout(() => { stop?.(); reject(new Error('The live update did not arrive.')); }, 15000); stop = onSnapshot(ref, { includeMetadataChanges: true }, (value) => { if (predicate(value)) { clearTimeout(timeout); stop?.(); resolve(value); } }, (error) => { clearTimeout(timeout); reject(error); }); }); stops.push(() => stop?.()); return promise;
}
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1sAAAAASUVORK5CYII=';
manifest();
try {
  if (messagesOnly) {
    const buyer = await user('Buyer'), seller = await user('Seller');
    const { conversation } = await buyer.request('/conversations', { recipientId: seller.uid });
    const samples = [];
    for (let index = 0; index < 6; index++) {
      const sender = index % 2 === 0 ? buyer : seller;
      const recipient = index % 2 === 0 ? seller : buyer;
      const messages = query(collection(recipient.firestore, 'conversations', conversation.id, 'messages'));
      await nextSnapshot(messages, (snapshot) => !snapshot.metadata.fromCache);
      const clientId = `timing-${index}`, text = `Disposable messaging check ${index}`;
      const started = performance.now();
      const delivered = nextSnapshot(messages, (snapshot) => !snapshot.metadata.fromCache && snapshot.docs.some((entry) => entry.data().clientId === clientId))
        .then(() => Math.round(performance.now() - started));
      const [{ message }, elapsed] = await Promise.all([sender.request(`/conversations/${conversation.id}/messages`, { text, clientId }), delivered]);
      assert.equal(message.seq, index + 1); assert.equal(message.text, text);
      samples.push(elapsed);
    }
    const retry = await buyer.request(`/conversations/${conversation.id}/messages`, { text: 'Disposable messaging check 0', clientId: 'timing-0' });
    assert.equal(retry.message.seq, 1);
    const history = await getDocs(collection(seller.firestore, 'conversations', conversation.id, 'messages'));
    assert.deepEqual(history.docs.map((entry) => entry.data().seq).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
    const readReceipt = nextSnapshot(doc(seller.firestore, 'conversations', conversation.id), (snapshot) => !snapshot.metadata.fromCache && snapshot.data()?.readBy[buyer.uid] === 6);
    await Promise.all([buyer.request(`/conversations/${conversation.id}/read`, { throughSeq: 6 }), readReceipt]);
    const sellerReceipt = nextSnapshot(doc(buyer.firestore, 'conversations', conversation.id), (snapshot) => !snapshot.metadata.fromCache && snapshot.data()?.readBy[seller.uid] === 6);
    await Promise.all([seller.request(`/conversations/${conversation.id}/read`, { throughSeq: 6 }), sellerReceipt]);
    await assert.rejects(buyer.request(`/conversations/${conversation.id}/messages`, { text: 'Changed retry', clientId: 'timing-0' }), (error) => error.status === 409);
    console.log('Live cloud two-way delivery, message ordering, duplicate prevention and read receipts passed.');
    console.log(JSON.stringify({ deliveryMs: samples, fastestMs: Math.min(...samples), slowestMs: Math.max(...samples), allWithinTwoSeconds: samples.every((elapsed) => elapsed <= 2000), measuredFrom: 'This computer to a second Firebase client; physical phones were not measured.' }));
    if (includeCalls) {
      await seller.request(`/conversations/${conversation.id}/messages`, { text: 'Unread reply before calling', clientId: 'unread-before-call' });
      const { iceServers } = await buyer.request('/calls/ice');
      const relayConfigured = iceServers.some((server) => [server.urls].flat().some((url) => /^turns?:/.test(url)));
      console.log(JSON.stringify({ relayConfigured, physicalAudioTested: false }));
      const ringing = nextSnapshot(doc(seller.firestore, 'callState', seller.uid), (snapshot) => !!snapshot.data()?.callId);
      const { call } = await buyer.request('/calls', { conversationId: conversation.id, clientId: 'voice-probe' });
      assert.equal((await ringing).data().callId, call.id);
      assert.equal((await buyer.request('/calls', { conversationId: conversation.id, clientId: 'voice-probe' })).call.id, call.id);
      const accepted = nextSnapshot(doc(buyer.firestore, 'voiceCalls', call.id), (snapshot) => snapshot.data()?.status === 'accepted');
      await Promise.all([seller.request(`/calls/${call.id}/accept`, {}), accepted]);
      const description = (type) => ({ type, sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' });
      const offer = { type: 'offer', payload: description('offer'), clientId: 'offer-probe' };
      const offered = nextSnapshot(query(collection(seller.firestore, 'voiceCalls', call.id, 'signals'), where('toUid', '==', seller.uid)), (snapshot) => snapshot.docs.some((entry) => entry.data().type === 'offer'));
      await Promise.all([buyer.request(`/calls/${call.id}/signals`, offer), offered]);
      await buyer.request(`/calls/${call.id}/signals`, offer);
      const answered = nextSnapshot(query(collection(buyer.firestore, 'voiceCalls', call.id, 'signals'), where('toUid', '==', buyer.uid)), (snapshot) => snapshot.docs.some((entry) => entry.data().type === 'answer'));
      await Promise.all([seller.request(`/calls/${call.id}/signals`, { type: 'answer', payload: description('answer'), clientId: 'answer-probe' }), answered]);
      for (const sender of [buyer, seller]) await sender.request(`/calls/${call.id}/signals`, { type: 'ice', payload: { candidate: 'candidate:1 1 UDP 2122260223 127.0.0.1 9 typ host', sdpMid: '0', sdpMLineIndex: 0 }, clientId: 'ice-probe' });
      assert.equal((await getDocs(query(collection(seller.firestore, 'voiceCalls', call.id, 'signals'), where('toUid', '==', seller.uid)))).docs.length, 2);
      assert.equal((await buyer.request(`/calls/${call.id}/connected`, {})).call.connectedAt, null);
      assert.ok((await seller.request(`/calls/${call.id}/connected`, {})).call.connectedAt);
      const ended = nextSnapshot(doc(seller.firestore, 'voiceCalls', call.id), (snapshot) => snapshot.data()?.status === 'ended');
      await Promise.all([buyer.request(`/calls/${call.id}/end`, { reason: 'hangup' }), ended]);
      for (const participant of [buyer, seller]) assert.equal((await getDoc(doc(participant.firestore, 'callState', participant.uid))).data().callId, null);
      assert.equal((await getDocs(query(collection(seller.firestore, 'voiceCalls', call.id, 'signals'), where('toUid', '==', seller.uid)))).docs.length, 0);
      const afterCall = await getDoc(doc(buyer.firestore, 'conversations', conversation.id));
      assert.equal(afterCall.data().seq, 8); assert.equal(afterCall.data().readBy[buyer.uid], 6);
      const seenAfterOpening = nextSnapshot(doc(seller.firestore, 'conversations', conversation.id), (snapshot) => !snapshot.metadata.fromCache && snapshot.data()?.readBy[buyer.uid] === 8);
      await Promise.all([buyer.request(`/conversations/${conversation.id}/read`, { throughSeq: 8 }), seenAfterOpening]);
      console.log('Live call ringing, answer, offer/answer and ICE signaling, duplicate prevention, hangup and busy-lock cleanup passed (audio was not captured).');
      console.log('Call summaries kept unread replies unseen until the recipient opened the conversation.');
    }
  } else {
  const seller = await user('Seller'), buyer = await user('Buyer'), reviewer = await user('Reviewer');
  await store.transact(async (tx) => tx.set(`roles/${reviewer.uid}`, { reviewer: true }));
  await seller.request('/session/bootstrap'); await seller.user.getIdToken(true);
  await seller.request('/auth/photo', { photo: png }); const profile = await getDoc(doc(seller.firestore, 'users', seller.uid)); assert.match(profile.data().avatar.url, /^https:\/\/res\.cloudinary\.com\/dnbmd5qhj\//);
  await assert.rejects(buyer.request(`/verification/reviews/${seller.uid}`), (error) => error.status === 403);
  await seller.request('/verification/id', { idType: 'National ID', fullName: seller.personal.fullName, photo: png, consent: true });
  const reviews = await reviewer.request('/verification/reviews'); const submitted = reviews.reviews.find((entry) => entry.userId === seller.uid); assert.ok(submitted);
  const photo = await reviewer.request(`/verification/reviews/${seller.uid}`); assert.match(photo.photo, /^data:image\/(png|jpeg);base64,/);
  await reviewer.request(`/verification/reviews/${seller.uid}`, { submissionId: submitted.submissionId, decision: 'verified' });
  assert.equal((await getDoc(doc(seller.firestore, 'verifications', seller.uid))).data().status, 'verified'); console.log('Live profile photo, private ID upload, reviewer access and approval passed.');
  const uploaded = await seller.request('/uploads', { kind: 'listing', photo: png, name: 'livestock.png' });
  const proof = await seller.request('/uploads', { kind: 'vaccination', photo: Buffer.from('%PDF-1.4\nDisposable probe\n%%EOF').toString('base64'), name: 'proof.pdf' });
  const listingId = `probe_${run}`; const listing = { id: listingId, status: 'active', title: 'Disposable Cloud Probe Cow', category: 'Cow', details: '', price: 45000, priceUnit: 'per head', location: 'Tagum City, Davao del Norte', weight: '450 kg', age: '2 years', health: 'Vaccinated', description: 'Temporary integration test', imageUris: [uploaded.uri], vaccinationProof: { name: proof.name, uri: proof.uri } };
  const appeared = nextSnapshot(query(collection(buyer.firestore, 'listings'), where('status', '==', 'active')), (snapshot) => snapshot.docs.some((entry) => entry.id === listingId));
  const saved = await seller.request('/listings/publish', { listing, pickupPin: { latitude: 7.4475, longitude: 125.8078 } }); await appeared; assert.equal(saved.listing.seller.id, seller.uid);
  await assert.rejects(buyer.request(`/listings/${listingId}/remove`, {}), (error) => error.status === 403);
  const pin = await buyer.request(`/listings/${listingId}/pin`); assert.equal(pin.pin.latitude, 7.4475);
  const date = new Date(Date.now() + 48 * 3600000).toISOString().slice(0, 10); const orderId = `probe_order_${run}`;
  const arrived = nextSnapshot(query(collection(seller.firestore, 'orders'), where('participants', 'array-contains', seller.uid)), (snapshot) => snapshot.docs.some((entry) => entry.id === orderId));
  const placed = (await buyer.request('/orders/save', { order: { id: orderId, ownerId: buyer.uid, status: 'saved-locally', draft: { item: saved.listing, payment: 'cod', fulfillment: 'pickup', pickup: { date, time: '8:00 AM–10:00 AM' }, delivery: null, totalMin: 1, totalMax: 1 } } })).order; await arrived; assert.equal(placed.draft.totalMin, 45000);
  let current = placed; for (const status of ['accepted', 'scheduled', 'ready']) current = (await seller.request('/orders/save', { order: { ...current, status } })).order;
  current = (await buyer.request('/orders/save', { order: { ...current, status: 'completed' } })).order; assert.equal(current.status, 'completed'); console.log('Live public photo, private PDF, listing ownership, buyer/seller updates and order lifecycle passed.');
  const { conversation } = await buyer.request('/conversations', { recipientId: seller.uid });
  const liveMessage = nextSnapshot(query(collection(seller.firestore, 'conversations'), where('participants', 'array-contains', seller.uid)), (snapshot) => snapshot.docs.some((entry) => entry.id === conversation.id && entry.data().seq >= 1));
  await buyer.request(`/conversations/${conversation.id}/messages`, { text: 'Cloud probe message', clientId: 'first' }); await liveMessage;
  const liveReply = nextSnapshot(query(collection(buyer.firestore, 'conversations', conversation.id, 'messages')), (snapshot) => snapshot.docs.some((entry) => entry.data().text === 'Cloud probe reply'));
  await seller.request(`/conversations/${conversation.id}/messages`, { text: 'Cloud probe reply', clientId: 'reply' }); await liveReply; console.log('Live two-way messages passed.');
  const { call } = await buyer.request('/calls', { conversationId: conversation.id, clientId: 'call' });
  assert.equal((await getDoc(doc(seller.firestore, 'callState', seller.uid))).data().callId, call.id); await seller.request(`/calls/${call.id}/accept`, {});
  await buyer.request(`/calls/${call.id}/signals`, { type: 'offer', clientId: 'offer', payload: { type: 'offer', sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' } });
  const signals = await getDocs(query(collection(seller.firestore, 'voiceCalls', call.id, 'signals'), where('toUid', '==', seller.uid))); assert.equal(signals.docs.length, 1);
  await assert.rejects(getDocs(query(collection(reviewer.firestore, 'voiceCalls', call.id, 'signals'), where('toUid', '==', reviewer.uid))));
  await buyer.request(`/calls/${call.id}/end`, { reason: 'hangup' }); assert.equal((await getDoc(doc(seller.firestore, 'callState', seller.uid))).data().callId, null); console.log('Live ringing, answer, private call signaling, hangup and lock cleanup passed.');
  await seller.request(`/listings/${listingId}/remove`, {}); await seller.request('/auth/photo/remove', {});
  }
} finally {
  stops.forEach((stop) => stop());
  let cleaned = false;
  try {
    for (const { uid, email } of resources.users) {
      assert.ok(email.startsWith(`cloud-probe-${run}-`)); const profile = await store.get(`users/${uid}`); if (profile) assert.equal(profile.personal.email, email);
      if (!messagesOnly) {
        const uploads = await store.query('uploads', [filter('ownerId', uid)]);
        for (const upload of uploads) await store.transact(async (tx) => tx.set(`uploads/${upload.id}`, { ...upload, refs: [], expiresAt: 1 }));
      }
    }
    if (!messagesOnly) await cleanupRemote();
    const paths = new Set();
    for (const { uid, email } of resources.users) {
      const chats = await store.query('conversations', [filter('participants', uid, 'ARRAY_CONTAINS')]);
      for (const chat of chats) { paths.add(`conversations/${chat.id}`); for (const message of await store.query(`conversations/${chat.id}/messages`)) paths.add(`conversations/${chat.id}/messages/${message.id}`); }
      if (!messagesOnly || includeCalls) {
        for (const call of await store.query('voiceCalls', [filter('participants', uid, 'ARRAY_CONTAINS')])) { paths.add(`voiceCalls/${call.id}`); for (const signal of await store.query(`voiceCalls/${call.id}/signals`)) paths.add(`voiceCalls/${call.id}/signals/${signal.id}`); }
      }
      if (!messagesOnly) {
        for (const order of await store.query('orders', [filter('participants', uid, 'ARRAY_CONTAINS')])) paths.add(`orders/${order.id}`);
        for (const listing of await store.query('listings', [filter('seller.id', uid)])) { paths.add(`listings/${listing.id}`); paths.add(`listingPrivate/${listing.id}`); }
      }
      for (const key of messagesOnly ? ['users', 'directory', ...(includeCalls ? ['callState'] : [])] : ['users', 'directory', 'roles', 'verifications', 'callState']) paths.add(`${key}/${uid}`);
      await google(`https://identitytoolkit.googleapis.com/v1/projects/${config.projectId}/accounts:delete`, 'POST', { localId: uid });
    }
    await store.transact(async (tx) => { for (const name of paths) tx.delete(name); }); cleaned = true; console.log(messagesOnly ? 'Disposable messaging users and records cleaned up.' : 'Disposable cloud users, records and uploaded media cleaned up. Firebase billing remains disabled.');
  } finally { await Promise.allSettled(apps.map((app) => deleteApp(app))); if (cleaned) fs.unlinkSync(manifestPath); }
}
