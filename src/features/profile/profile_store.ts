import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { isDavaoDelNorteLocality } from '@/constants/davao_del_norte';
import { ApiError, apiRequest, getAccessToken, onUnauthorized, setAccessToken } from '@/services/api';
import type { IdentityVerification, ValidIdType } from './domain/identity_verification';
import { emailError, passwordError } from '../auth/domain/credential_policy';
import type { Account, AccountSession as Session, PersonalInformation } from './domain/account';
import { validatePersonalAddress } from './domain/personal_information';
import { firebaseEnabled } from '@/services/firebase_config';
import { getFirebaseServices } from '@/services/firebase';
import { readFirebaseAccount } from '@/services/firebase_account';
import { firebaseError } from '@/services/firebase_errors';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export type { PersonalInformation } from './domain/account';
type AccountSnapshot = { signedIn: boolean; loading: boolean; error: string | null; userId: string; username: string; personal: PersonalInformation; verification: IdentityVerification; isReviewer: boolean; isStaff: boolean; avatarVersion: string | null };
const empty: AccountSnapshot = { signedIn: false, loading: false, error: null, userId: '', username: '', personal: { fullName: '', email: '', phone: '', city: '', street: '', barangay: '', postalCode: '' }, verification: { status: 'unverified' }, isReviewer: false, isStaff: false, avatarVersion: null };
let snapshot: AccountSnapshot = { ...empty, loading: true };
const listeners = new Set<() => void>();
let initialized: Promise<void> | undefined;
let generation = 0;
let storageQueue = Promise.resolve();
const storageKey = 'animarket.session.v1';
let authMutations = 0;
let stopAuth: (() => void) | undefined;
function finishAuthMutation() {
  authMutations--;
  if (!firebaseEnabled || authMutations) return;
  // A cancelled sign-in followed by a failed newer attempt must not leave
  // the cancelled account persisted in Firebase behind a signed-out screen.
  if ((getFirebaseServices().auth.currentUser?.uid ?? '') !== (snapshot.signedIn ? snapshot.userId : '')) signOut();
}
function publish(next: AccountSnapshot) { snapshot = next; listeners.forEach((listener) => listener()); }
export function subscribeAccount(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getAccountSnapshot() { return snapshot; }
export function useAccount() { return useSyncExternalStore(subscribeAccount, getAccountSnapshot, getAccountSnapshot); }
function accountSnapshot(account: Account): AccountSnapshot { return { userId: account.id, username: account.username, personal: account.personal, verification: account.verification ?? { status: 'unverified' }, isReviewer: account.isReviewer === true, isStaff: account.isStaff === true, avatarVersion: account.avatarVersion ?? null, signedIn: true, loading: false, error: null }; }
function storeSession(session: Session | null) {
  // Firebase owns token refresh and persisted login. Never persist a second session.
  if (firebaseEnabled) return Promise.resolve();
  const write = async () => {
    if (Platform.OS === 'web') {
      if (session) localStorage.setItem(storageKey, JSON.stringify(session)); else localStorage.removeItem(storageKey);
    } else if (session) await SecureStore.setItemAsync(storageKey, JSON.stringify(session));
    else await SecureStore.deleteItemAsync(storageKey);
  };
  storageQueue = storageQueue.catch(() => {}).then(write);
  return storageQueue;
}
function clearSession() {
  generation++; setAccessToken(null); publish({ ...empty }); void storeSession(null).catch(() => {});
}
onUnauthorized(clearSession);
export function initializeAccount() {
  if (initialized) return initialized;
  initialized = (async () => {
    const epoch = generation;
    try {
      if (firebaseEnabled) {
        const { auth } = getFirebaseServices();
        await auth.authStateReady();
        const initialUid = auth.currentUser?.uid ?? '';
        try {
          if (epoch === generation) {
            if (auth.currentUser) {
              const account = await readFirebaseAccount(auth.currentUser);
              if (epoch === generation) { setAccessToken(`firebase:${account.id}`); publish(accountSnapshot(account)); }
            } else publish({ ...empty });
          }
        } finally {
          // Observe future changes even if the initial profile cannot be read.
          let first = true;
          stopAuth ??= onAuthStateChanged(auth, (user) => {
            if (first) { first = false; if ((user?.uid ?? '') === initialUid) return; }
            if (authMutations || (user?.uid ?? '') === (snapshot.signedIn ? snapshot.userId : '')) return;
            const current = ++generation;
            setAccessToken(null); publish({ ...empty, loading: !!user });
            if (user) void readFirebaseAccount(user).then((account) => {
              if (current === generation) { setAccessToken(`firebase:${account.id}`); publish(accountSnapshot(account)); }
            }).catch((error) => { if (current === generation) publish({ ...empty, error: firebaseError(error).message }); });
          });
        }
        return;
      }
      const saved = Platform.OS === 'web' ? localStorage.getItem(storageKey) : await SecureStore.getItemAsync(storageKey);
      if (epoch !== generation) return;
      if (!saved) { publish({ ...empty }); return; }
      const session: Session = JSON.parse(saved);
      if (!/^[a-f0-9]{64}$/.test(session.token) || !session.account?.id || !session.account?.personal || (session.account.personal.city !== '' && !isDavaoDelNorteLocality(session.account.personal.city))) throw new Error('Invalid session');
      setAccessToken(session.token);
      try {
        const result = await apiRequest<{ account: Account }>('/auth/me');
        if (epoch === generation) {
          await storeSession({ token: session.token, account: result.account });
          if (epoch === generation) publish(accountSnapshot(result.account));
        }
      } catch (error) {
        // Cached identity allows reconnection; the server still authorizes every request.
        if (epoch === generation && !(error instanceof ApiError && error.status === 401)) publish(accountSnapshot(session.account));
      }
    } catch (error) {
      if (epoch === generation) {
        if (firebaseEnabled) { setAccessToken(null); publish({ ...empty, error: firebaseError(error).message }); }
        else clearSession();
      }
    }
  })();
  return initialized;
}
export function retryInitializeAccount() {
  stopAuth?.(); stopAuth = undefined; initialized = undefined; generation++;
  publish({ ...empty, loading: true }); return initializeAccount();
}
export function dismissAccountError() { publish({ ...snapshot, error: null }); }
async function acceptSession(session: Session, epoch: number) {
  if (epoch !== generation) return 'Sign-in was cancelled. Please try again.';
  try { await storeSession(session); }
  catch { return 'Unable to save your sign-in securely. Please try again.'; }
  if (epoch !== generation) return 'Sign-in was cancelled. Please try again.';
  setAccessToken(session.token); publish(accountSnapshot(session.account)); return null;
}
export async function signIn(email: string, password: string): Promise<string | null> {
  const epoch = ++generation;
  authMutations++;
  try { return await acceptSession(await apiRequest<Session>('/auth/login', { public: true, method: 'POST', body: { email: email.trim(), password } }), epoch); }
  catch (error) { return error instanceof Error ? error.message : 'Unable to sign in.'; }
  finally { finishAuthMutation(); }
}
export async function registerAccount(values: { firstName: string; middleName: string; lastName: string; email: string; phone: string; password: string }): Promise<string | null> {
  const epoch = ++generation;
  authMutations++;
  try {
    const session = await apiRequest<Session>('/auth/register', { public: true, method: 'POST', body: {
      fullName: [values.firstName, values.middleName, values.lastName].map((part) => part.trim()).filter(Boolean).join(' '),
      email: values.email, phone: values.phone, password: values.password, acceptedTerms: true,
    } });
    return await acceptSession(session, epoch);
  } catch (error) { return error instanceof Error ? error.message : 'Unable to create your account.'; }
  finally { finishAuthMutation(); }
}
export function signOut() {
  const token = getAccessToken(); clearSession();
  if (token || firebaseEnabled) {
    authMutations++;
    void apiRequest('/auth/logout', { token, method: 'POST', body: {} }).catch((error) => {
      if (firebaseEnabled && !snapshot.signedIn) publish({ ...empty, error: firebaseError(error).message });
    }).finally(() => { authMutations--; });
  }
}
export function validatePersonalInformation(personal: PersonalInformation): string | null {
  if (!personal.fullName.trim()) return 'Enter your full name.';
  const emailIssue = emailError(personal.email);
  if (emailIssue) return emailIssue;
  if (!/^[+\d\s()-]{7,20}$/.test(personal.phone.trim())) return 'Enter a valid phone number.';
  return Object.values(validatePersonalAddress(personal))[0] ?? null;
}
export async function savePersonalInformation(personal: PersonalInformation, emailChange?: { currentPassword: string }): Promise<string | null> {
  const issue = validatePersonalInformation(personal); if (issue) return issue;
  if (personal.email.trim().toLowerCase() !== snapshot.personal.email.toLowerCase() && (!emailChange || !emailChange.currentPassword)) return 'Enter your current password to change your email.';
  const epoch = generation; const token = getAccessToken();
  try {
    const { account } = await apiRequest<{ account: Account }>('/auth/me', { method: 'PATCH', body: { ...personal, ...emailChange } });
    if (epoch !== generation || !token) return 'Please sign in again.';
    await storeSession({ token, account });
    if (epoch !== generation) return 'Please sign in again.';
    publish(accountSnapshot(account)); return null;
  } catch (error) { return error instanceof Error ? error.message : 'Unable to save your information.'; }
}
export async function changePassword(current: string, next: string, confirmation: string): Promise<string | null> {
  if (!snapshot.signedIn) return 'Sign in before changing your password.';
  const passwordIssue = passwordError(next);
  if (passwordIssue) return passwordIssue;
  if (next === current) return 'Choose a different password.';
  if (next !== confirmation) return 'New passwords do not match.';
  try { await apiRequest('/auth/password', { method: 'POST', body: { current, next } }); return null; }
  catch (error) { return error instanceof Error ? error.message : 'Unable to change your password.'; }
}

let refreshRequest: { token: string | null; promise: Promise<AccountSnapshot> } | undefined;
async function updateAccount(path: string, body?: unknown) {
  const epoch = generation; const token = getAccessToken();
  const { account } = await apiRequest<{ account: Account }>(path, { method: body ? 'POST' : 'GET', body, timeout: body ? 30000 : 12000 });
  if (epoch !== generation || !token) throw new Error('Please sign in again.');
  await storeSession({ token, account });
  if (epoch !== generation) throw new Error('Please sign in again.');
  publish(accountSnapshot(account)); return snapshot;
}
export function refreshAccount() {
  const token = getAccessToken();
  if (!refreshRequest || refreshRequest.token !== token) {
    const promise = updateAccount('/auth/me').finally(() => { if (refreshRequest?.promise === promise) refreshRequest = undefined; });
    refreshRequest = { token, promise };
  }
  return refreshRequest.promise;
}
export async function submitIdentity(idType: ValidIdType, photo: string) {
  if (Object.keys(validatePersonalAddress(snapshot.personal)).length) throw new Error('Complete your address in Personal Information before submitting your ID for verification.');
  return updateAccount('/verification/id', { idType, photo, fullName: snapshot.personal.fullName, consent: true });
}
export const withdrawIdentity = () => updateAccount('/verification/withdraw', {});
export const checkSellerEligibility = () => updateAccount('/verification/eligibility');
export const saveProfilePhoto = (photo: string) => updateAccount('/auth/photo', { photo });
export const removeProfilePhoto = () => updateAccount('/auth/photo/remove', {});

let observedUser = '';
let stopProfile: (() => void)[] = [];
if (firebaseEnabled) subscribeAccount(() => {
  const uid = snapshot.signedIn ? snapshot.userId : '';
  if (uid === observedUser) return;
  stopProfile.forEach((stop) => stop()); stopProfile = []; observedUser = uid;
  if (!uid) return;
  const db = getFirebaseServices().firestore;
  for (const name of ['users', 'roles', 'verifications']) {
    let first = true;
    stopProfile.push(onSnapshot(doc(db, name, uid), () => {
      if (first) { first = false; return; }
      if (snapshot.userId === uid) void refreshAccount().catch((error) => {
        if (snapshot.userId !== uid) return;
        if (snapshot.isStaff) signOut();
        else publish({ ...snapshot, error: firebaseError(error).message });
      });
    }, (error) => {
      // Never retain reviewer/verified privileges when their authoritative feed is denied.
      if (snapshot.userId !== uid) return;
      if (snapshot.isStaff) signOut();
      else publish({ ...snapshot, isReviewer: false, verification: { status: 'unverified' }, error: firebaseError(error).message });
    }));
  }
});
