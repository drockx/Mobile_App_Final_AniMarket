import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, setPersistence, browserSessionPersistence, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, query, where, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { createMarketPrices } from './market_prices.js';

const app = initializeApp({ apiKey: 'AIzaSyAhZIUbXYCrmaQSytYX_t8ubBMnzugsd_E', authDomain: 'animarket-87354.firebaseapp.com', projectId: 'animarket-87354', appId: '1:144256379000:web:ec46e106870561cb1e658d' });
const auth = getAuth(app), db = getFirestore(app);
const $ = (id) => document.getElementById(id);
let session = 0, stopQueue, stopRole, selected = null, selecting = 0, busy = false;
const stamp = (value) => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable'; };
function notice(message = '', error = false) { $('notice').textContent = message; $('notice').hidden = !message; $('notice').classList.toggle('error', error); }
function clearReview() { selected = null; selecting++; $('id-photo').removeAttribute('src'); $('review').hidden = true; $('choose').hidden = false; $('reason').value = ''; $('confirm').checked = false; $('approve').disabled = true; document.querySelectorAll('.queue-item').forEach((item) => item.setAttribute('aria-pressed', 'false')); }
function clean() { stopQueue?.(); stopRole?.(); prices.stop(); stopQueue = stopRole = undefined; $('queue').replaceChildren(); clearReview(); $('workspace').hidden = true; $('denied-panel').hidden = true; busy = false; showSection('reviews'); }
async function request(path, body, method = 'GET') {
  const user = auth.currentUser, generation = session;
  if (!user) throw new Error('Sign in again.');
  const token = await user.getIdToken();
  const response = await fetch('https://yvamvsbfbknnasfvqdto.supabase.co/functions/v1/animarket', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, apikey: 'sb_publishable_UQaNRAivn0O1jI8L9lRrCg__2RDOPM_', 'content-type': 'application/json' },
    body: JSON.stringify({ path, method, body: body ?? {} }), cache: 'no-store', signal: AbortSignal.timeout(25000),
  });
  const data = await response.json();
  if (generation !== session || auth.currentUser?.uid !== user.uid) throw new Error('The signed-in account changed.');
  if (!response.ok) { if (response.status === 401) await signOut(auth); throw new Error(data.error ?? 'The request could not be completed. Refresh and retry.'); }
  return data;
}
const prices = createMarketPrices({ db, request, notice });
function showSection(section) {
  const market = section === 'prices'; $('prices-pane').hidden = !market; $('reviews-pane').hidden = market;
  for (const [id, active] of [['reviews-tab', !market], ['prices-tab', market]]) { $(id).className = active ? 'primary' : 'outline'; $(id).setAttribute('aria-pressed', String(active)); }
}
$('reviews-tab').addEventListener('click', () => { if (!prices.busy()) { notice(); showSection('reviews'); } });
$('prices-tab').addEventListener('click', () => { if (!busy) { clearReview(); notice(); showSection('prices'); } });
function controls() { $('approve').disabled = busy || !selected || !$('confirm').checked; $('reject').disabled = busy || !selected; $('close-review').disabled = busy; }
async function openReview(row, button) {
  if (busy) return;
  clearReview(); const attempt = selecting, generation = session;
  notice('Loading private ID…');
  try {
    const detail = await request(`/verification/reviews/${encodeURIComponent(row.userId)}`);
    if (generation !== session || attempt !== selecting) return;
    if (detail.submissionId !== row.submissionId) throw new Error('This submission changed. Refresh the queue.');
    selected = detail;
    $('name').textContent = detail.fullName; $('id-type').textContent = detail.idType; $('city').textContent = detail.city; $('submitted').textContent = stamp(detail.submittedAt);
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(detail.photo ?? '')) throw new Error('The ID photo could not be loaded. Refresh and retry.');
    $('id-photo').src = detail.photo; $('review').hidden = false; $('choose').hidden = true;
    document.querySelectorAll('.queue-item').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    controls(); notice();
    if (matchMedia('(max-width: 680px)').matches) $('review').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { if (generation === session && attempt === selecting) { clearReview(); notice(error.message || 'Unable to load the ID.', true); } }
}
function renderQueue(snapshot) {
  const rows = snapshot.docs.map((entry) => entry.data()).filter((row) => row.userId !== auth.currentUser?.uid && row.expiresAt > Date.now()).sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
  if (selected && !rows.some((row) => row.submissionId === selected.submissionId)) clearReview();
  $('count').textContent = rows.length; $('empty').hidden = rows.length > 0;
  $('queue').replaceChildren(...rows.map((row) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'queue-item'; button.setAttribute('aria-pressed', String(selected?.submissionId === row.submissionId));
    const name = document.createElement('strong'), detail = document.createElement('small'); name.textContent = row.fullName; detail.textContent = `${row.idType} · ${stamp(row.submittedAt)}`;
    button.append(name, detail); button.addEventListener('click', () => openReview(row, button)); return button;
  }));
}
function watchQueue() {
  stopQueue?.(); const generation = session;
  stopQueue = onSnapshot(query(collection(db, 'verifications'), where('status', '==', 'pending'), limit(100)), (snapshot) => { if (generation === session) renderQueue(snapshot); }, () => { if (generation === session) notice('The review queue could not load. Check your connection and refresh.', true); });
}
async function decide(decision) {
  if (busy || !selected) return;
  if (decision === 'verified' && !$('confirm').checked) return;
  const reason = $('reason').value.trim();
  if (decision === 'rejected' && !reason) { notice('Enter a reason so the user knows what to correct.', true); $('reason').focus(); return; }
  const row = selected, generation = session; busy = true; controls(); notice('Saving decision…');
  try {
    await request(`/verification/reviews/${encodeURIComponent(row.userId)}`, { submissionId: row.submissionId, decision, reason }, 'POST');
    if (generation !== session) return;
    clearReview(); notice(decision === 'verified' ? 'Account approved. The ID photo has been removed.' : 'ID rejected. The user can correct and resubmit.');
  } catch (error) { if (generation === session) notice(error.message || 'The decision could not be saved. Refresh before retrying.', true); }
  finally { if (generation === session) { busy = false; controls(); } }
}
$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if ($('login').disabled) return; $('login').disabled = true; notice('Signing in…');
  try { await setPersistence(auth, browserSessionPersistence); await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value); $('password').value = ''; }
  catch (error) { notice(error.code === 'auth/too-many-requests' ? 'Too many attempts. Wait a moment and try again.' : error.code === 'auth/network-request-failed' ? 'Check your internet connection and try again.' : 'Sign-in failed. Check your reviewer email and password.', true); }
  finally { $('login').disabled = false; }
});
$('show-password').addEventListener('click', () => { const show = $('password').type === 'password'; $('password').type = show ? 'text' : 'password'; $('show-password').textContent = show ? 'Hide' : 'Show'; $('show-password').setAttribute('aria-label', show ? 'Hide password' : 'Show password'); });
$('logout').addEventListener('click', async () => { try { await signOut(auth); notice('Signed out.'); } catch { notice('Unable to sign out. Close this browser tab.', true); } });
$('refresh').addEventListener('click', () => { clearReview(); notice(); watchQueue(); });
$('close-review').addEventListener('click', () => { if (!busy) clearReview(); });
$('confirm').addEventListener('change', controls);
$('approve').addEventListener('click', () => decide('verified'));
$('reject').addEventListener('click', () => decide('rejected'));
onAuthStateChanged(auth, async (user) => {
  const generation = ++session; clean(); $('login-panel').hidden = !!user; $('logout').hidden = !user;
  if (!user) return;
  notice('Checking reviewer access…');
  try {
    const role = await getDoc(doc(db, 'roles', user.uid));
    if (generation !== session) return;
    if (role.data()?.reviewer !== true) { $('denied-panel').hidden = false; notice(); return; }
    $('workspace').hidden = false; notice(); watchQueue();
    let staff = role.data()?.staff === true;
    if (staff) prices.start();
    stopRole = onSnapshot(doc(db, 'roles', user.uid), (snapshot) => {
      if (generation !== session) return;
      if (snapshot.data()?.reviewer !== true) { clean(); $('denied-panel').hidden = false; notice('Reviewer access was removed.', true); return; }
      const nextStaff = snapshot.data()?.staff === true;
      if (nextStaff !== staff) { staff = nextStaff; if (staff) prices.start(); else { prices.stop(); showSection('reviews'); notice('Market price editing access was removed.', true); } }
    }, () => { if (generation === session) { clean(); $('denied-panel').hidden = false; notice('Reviewer access could not be confirmed. Sign in again.', true); } });
  } catch { if (generation === session) { $('denied-panel').hidden = false; notice('Reviewer access could not be checked. Check your connection and sign in again.', true); } }
});
