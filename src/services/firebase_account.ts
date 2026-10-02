import { createUserWithEmailAndPassword, EmailAuthProvider, reauthenticateWithCredential, signInWithEmailAndPassword, signOut, updateEmail, updatePassword, updateProfile, type User } from 'firebase/auth';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { isDavaoDelNorteLocality } from '@/constants/davao_del_norte';
import { emailError, passwordError } from '@/features/auth/domain/credential_policy';
import type { Account, AccountSession, PersonalInformation } from '@/features/profile/domain/account';
import type { IdentityVerification } from '@/features/profile/domain/identity_verification';
import { ApiError } from './api_error';
import { getFirebaseServices } from './firebase';
import { firebaseError } from './firebase_errors';
import { requireFirebaseUser } from './firebase_identity';
export { requireFirebaseUser } from './firebase_identity';

type Profile = { id: string; username: string; personal: PersonalInformation; acceptedTerms: true; createdAt: string; street?: string; barangay?: string; postalCode?: string; avatar?: { version: string; url: string } | null };
type Options = { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; token?: string | null; signal?: AbortSignal };
let authQueue: Promise<unknown> = Promise.resolve();
function serializeAuth<T>(action: () => Promise<T>): Promise<T> {
  const task = authQueue.catch(() => {}).then(action); authQueue = task; return task;
}
function requireText(value: unknown, label: string, max: number, optional = false): string {
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length > max) throw new ApiError(`Enter a valid ${label}.`, 400);
  return value.trim();
}
function personalInformation(body: Record<string, unknown>): PersonalInformation {
  const fullName = requireText(body.fullName, 'full name', 100);
  const email = requireText(body.email, 'email address', 254).toLowerCase();
  const phone = requireText(body.phone, 'phone number', 20);
  if (emailError(email)) throw new ApiError(emailError(email)!, 400);
  if (!/^[+\d\s()-]{7,20}$/.test(phone)) throw new ApiError('Enter a valid phone number.', 400);
  if (!isDavaoDelNorteLocality(String(body.city))) throw new ApiError('Choose a city or municipality in Davao del Norte.', 400);
  return { fullName, email, phone, city: body.city as PersonalInformation['city'] };
}
export async function readFirebaseAccount(user = requireFirebaseUser()): Promise<Account> {
  const { firestore, auth } = getFirebaseServices();
  const [profile, role, verification] = await Promise.all([
    getDoc(doc(firestore, 'users', user.uid)), getDoc(doc(firestore, 'roles', user.uid)), getDoc(doc(firestore, 'verifications', user.uid)),
  ]);
  if (auth.currentUser?.uid !== user.uid) throw new ApiError('Your account changed. Sign in again.', 401);
  if (!profile.exists()) throw new ApiError('Your Firebase account exists, but its profile is incomplete. Register again using the same email and password to finish setup.', 409);
  const record = profile.data() as Profile;
  if (record.id !== user.uid || !record.personal || !isDavaoDelNorteLocality(record.personal.city)) throw new ApiError('Your saved profile needs an administrator to correct it.', 409);
  const review = verification.data();
  const status: IdentityVerification = review?.fullName === record.personal.fullName && ['pending', 'verified', 'rejected', 'expired'].includes(review?.status)
    ? { status: review.status, idType: review.idType, submittedAt: review.submittedAt, reviewedAt: review.reviewedAt ?? null, reason: review.reason ?? '' }
    : { status: 'unverified' };
  return { id: user.uid, username: record.username, personal: { ...record.personal, email: user.email ?? record.personal.email },
    verification: status, isReviewer: role.data()?.reviewer === true, avatarVersion: record.avatar?.version ?? null };
}
async function saveProfile(profile: Profile) {
  const { firestore } = getFirebaseServices();
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, 'users', profile.id), profile);
  // Contact details and government IDs never enter the public user directory.
  batch.set(doc(firestore, 'directory', profile.id), { id: profile.id, fullName: profile.personal.fullName, nameLower: profile.personal.fullName.toLowerCase(), city: profile.personal.city });
  await batch.commit();
}
async function register(body: Record<string, unknown>): Promise<AccountSession> {
  const personal = personalInformation(body);
  const password = String(body.password ?? '');
  if (passwordError(password)) throw new ApiError(passwordError(password)!, 400);
  if (body.acceptedTerms !== true) throw new ApiError('Accept the terms before registering.', 400);
  const address = {
    street: requireText(body.street ?? '', 'purok/street', 150, true),
    barangay: requireText(body.barangay ?? '', 'barangay', 100, true),
    postalCode: requireText(body.postalCode ?? '', 'postal code', 4, true),
  };
  const { auth, firestore } = getFirebaseServices();
  let user: User;
  if (auth.currentUser?.email?.toLowerCase() === personal.email) {
    user = auth.currentUser;
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(personal.email, password));
  } else {
    try { user = (await createUserWithEmailAndPassword(auth, personal.email, password)).user; }
    catch (error) {
      if ((error as { code?: string })?.code !== 'auth/email-already-in-use') throw error;
      // A failed profile write may leave an Auth account. Prove its password
      // before repairing it, including after an app restart or logout.
      user = (await signInWithEmailAndPassword(auth, personal.email, password)).user;
    }
  }
  if ((await getDoc(doc(firestore, 'users', user.uid))).exists()) throw new ApiError('This email is already registered. Sign in to continue.', 409);
  await updateProfile(user, { displayName: personal.fullName });
  await saveProfile({ id: user.uid, username: personal.fullName, personal, acceptedTerms: true, createdAt: new Date().toISOString(),
    ...address, avatar: null });
  return { token: `firebase:${user.uid}`, account: await readFirebaseAccount(user) };
}
async function changePersonal(body: Record<string, unknown>, user: User) {
  const personal = personalInformation(body);
  const { firestore } = getFirebaseServices();
  const current = await getDoc(doc(firestore, 'users', user.uid));
  if (!current.exists()) throw new ApiError('Finish your account registration first.', 409);
  const before = current.data() as Profile;
  const previousEmail = user.email;
  const emailChanged = personal.email !== previousEmail?.toLowerCase();
  if (emailChanged) {
    const password = requireText(body.currentPassword, 'current password', 4096);
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(previousEmail!, password));
    await updateEmail(user, personal.email); await user.getIdToken(true);
  }
  try { await saveProfile({ ...before, username: personal.fullName, personal }); }
  catch (error) {
    if (emailChanged && previousEmail) {
      try { await updateEmail(user, previousEmail); await user.getIdToken(true); } catch { /* The next profile read uses the actual Auth email. */ }
    }
    throw error;
  }
  if (user.displayName !== personal.fullName) await updateProfile(user, { displayName: personal.fullName });
  return { account: await readFirebaseAccount(user) };
}
export async function firebaseAccountRequest(path: string, options: Options = {}): Promise<unknown> {
  if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
  const body = (options.body ?? {}) as Record<string, unknown>;
  const method = options.method ?? 'GET';
  try {
    if (path === '/auth/register' && method === 'POST') return await serializeAuth(() => register(body));
    if (path === '/auth/login' && method === 'POST') return await serializeAuth(async () => {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (emailError(email)) throw new ApiError(emailError(email)!, 400);
      const { user } = await signInWithEmailAndPassword(getFirebaseServices().auth, email, String(body.password ?? ''));
      return { token: `firebase:${user.uid}`, account: await readFirebaseAccount(user) };
    });
    if (path === '/auth/logout' && method === 'POST') return await serializeAuth(async () => { await signOut(getFirebaseServices().auth); return {}; });
    const user = requireFirebaseUser(options.token);
    if (path === '/auth/me') return method === 'PATCH' ? await serializeAuth(() => changePersonal(body, requireFirebaseUser(options.token))) : { account: await readFirebaseAccount(user) };
    if (path === '/auth/password' && method === 'POST') return await serializeAuth(async () => {
      const active = requireFirebaseUser(options.token); const next = String(body.next ?? ''); const current = String(body.current ?? '');
      if (passwordError(next)) throw new ApiError(passwordError(next)!, 400);
      if (current === next) throw new ApiError('Choose a different password.', 400);
      await reauthenticateWithCredential(active, EmailAuthProvider.credential(active.email!, current));
      await updatePassword(active, next); return {};
    });
    if (path === '/auth/photo' && method === 'GET') {
      const data = (await getDoc(doc(getFirebaseServices().firestore, 'users', user.uid))).data() as Profile | undefined;
      requireFirebaseUser(`firebase:${user.uid}`);
      if (!data?.avatar) throw new ApiError('No profile photo has been saved.', 404);
      return { version: data.avatar.version, photo: data.avatar.url };
    }
    if (path === '/verification/eligibility') {
      const account = await readFirebaseAccount(user);
      if (account.verification.status !== 'verified') throw new ApiError('Submit a valid government photo ID and wait for approval before publishing livestock.', 403);
      return { account };
    }
    throw new ApiError('This feature is waiting for the next backend connection step. Your account has not been changed.', 503);
  } catch (error) { throw firebaseError(error); }
}
