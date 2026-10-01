import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { DAVAO_DEL_NORTE, isDavaoDelNorteLocality, type DavaoDelNorteLocality } from '@/constants/davao_del_norte';
import { ApiError, apiRequest, getAccessToken, onUnauthorized, setAccessToken } from '@/services/api';

export type PersonalInformation = { fullName: string; email: string; phone: string; city: DavaoDelNorteLocality };
type Account = { id: string; username: string; personal: PersonalInformation };
type Session = { token: string; account: Account };
type AccountSnapshot = { signedIn: boolean; loading: boolean; userId: string; username: string; personal: PersonalInformation };
const empty: AccountSnapshot = { signedIn: false, loading: false, userId: '', username: '', personal: { fullName: '', email: '', phone: '', city: 'Tagum City' } };
let snapshot: AccountSnapshot = { ...empty, loading: true };
const listeners = new Set<() => void>();
let initialized: Promise<void> | undefined;
let generation = 0;
let storageQueue = Promise.resolve();
const storageKey = 'animarket.session.v1';
function publish(next: AccountSnapshot) { snapshot = next; listeners.forEach((listener) => listener()); }
export function subscribeAccount(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getAccountSnapshot() { return snapshot; }
export function useAccount() { return useSyncExternalStore(subscribeAccount, getAccountSnapshot, getAccountSnapshot); }
function accountSnapshot(account: Account): AccountSnapshot { return { userId: account.id, username: account.username, personal: account.personal, signedIn: true, loading: false }; }
function storeSession(session: Session | null) {
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
      const saved = Platform.OS === 'web' ? localStorage.getItem(storageKey) : await SecureStore.getItemAsync(storageKey);
      if (epoch !== generation) return;
      if (!saved) { publish({ ...empty }); return; }
      const session: Session = JSON.parse(saved);
      if (!/^[a-f0-9]{64}$/.test(session.token) || !session.account?.id || !session.account?.personal || !isDavaoDelNorteLocality(session.account.personal.city)) throw new Error('Invalid session');
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
    } catch { if (epoch === generation) clearSession(); }
  })();
  return initialized;
}
async function acceptSession(session: Session, epoch: number) {
  if (epoch !== generation) return 'Sign-in was cancelled. Please try again.';
  try { await storeSession(session); }
  catch { return 'Unable to save your sign-in securely. Please try again.'; }
  if (epoch !== generation) return 'Sign-in was cancelled. Please try again.';
  setAccessToken(session.token); publish(accountSnapshot(session.account)); return null;
}
export async function signIn(email: string, password: string): Promise<string | null> {
  const epoch = ++generation;
  try { return await acceptSession(await apiRequest<Session>('/auth/login', { public: true, method: 'POST', body: { email: email.trim(), password } }), epoch); }
  catch (error) { return error instanceof Error ? error.message : 'Unable to sign in.'; }
}
export async function registerAccount(values: { firstName: string; middleName: string; lastName: string; email: string; phone: string; municipalityCity: string; purok: string; barangay: string; postalCode: string; password: string }): Promise<string | null> {
  const epoch = ++generation;
  try {
    const session = await apiRequest<Session>('/auth/register', { public: true, method: 'POST', body: {
      fullName: [values.firstName, values.middleName, values.lastName].map((part) => part.trim()).filter(Boolean).join(' '),
      email: values.email, phone: values.phone, city: values.municipalityCity, street: values.purok, barangay: values.barangay, postalCode: values.postalCode, password: values.password, acceptedTerms: true,
    } });
    return await acceptSession(session, epoch);
  } catch (error) { return error instanceof Error ? error.message : 'Unable to create your account.'; }
}
export function signOut() {
  const token = getAccessToken(); clearSession();
  if (token) void apiRequest('/auth/logout', { token, method: 'POST', body: {} }).catch(() => {});
}
export function validatePersonalInformation(personal: PersonalInformation): string | null {
  if (!personal.fullName.trim()) return 'Enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email.trim())) return 'Enter a valid email address.';
  if (!/^[+\d\s()-]{7,20}$/.test(personal.phone.trim())) return 'Enter a valid phone number.';
  if (!isDavaoDelNorteLocality(personal.city)) return `${DAVAO_DEL_NORTE}: choose a city or municipality.`;
  return null;
}
export async function savePersonalInformation(personal: PersonalInformation): Promise<string | null> {
  const issue = validatePersonalInformation(personal); if (issue) return issue;
  const epoch = generation; const token = getAccessToken();
  try {
    const { account } = await apiRequest<{ account: Account }>('/auth/me', { method: 'PATCH', body: personal });
    if (epoch !== generation || !token) return 'Please sign in again.';
    await storeSession({ token, account });
    if (epoch !== generation) return 'Please sign in again.';
    publish(accountSnapshot(account)); return null;
  } catch (error) { return error instanceof Error ? error.message : 'Unable to save your information.'; }
}
export async function changePassword(current: string, next: string, confirmation: string): Promise<string | null> {
  if (!snapshot.signedIn) return 'Sign in before changing your password.';
  if (next.length < 8 || next.length > 128) return 'Use 8 to 128 characters for the new password.';
  if (next === current) return 'Choose a different password.';
  if (next !== confirmation) return 'New passwords do not match.';
  try { await apiRequest('/auth/password', { method: 'POST', body: { current, next } }); return null; }
  catch (error) { return error instanceof Error ? error.message : 'Unable to change your password.'; }
}
