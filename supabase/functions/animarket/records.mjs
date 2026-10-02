import { BackendError } from './core.mjs';

export function id(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(value)) throw new BackendError('Invalid record reference.', 400); return value;
}
export function text(value, label, maximum, optional = false) {
  if (typeof value !== 'string' || value.trim().length > maximum || (!optional && !value.trim())) throw new BackendError(`Enter a valid ${label}.`, 400); return value.trim();
}
export const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
export function member(record, uid) { if (!record?.participants?.includes(uid)) throw new BackendError('This record is unavailable for your account.', 404); return record; }
export const activeCall = (call) => !!call && ['ringing', 'accepted'].includes(call.status);
export async function hash(value) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, '0')).join(''); }
export function createAccounts({ store, now = Date.now }) {
  async function profile(uid, tx = store) {
    const value = await tx.get(`users/${id(uid)}`);
    if (!value?.personal || value.id !== uid || value.acceptedTerms !== true) throw new BackendError('Finish your account registration first.', 409); return value;
  }
  function status(review, person) {
    if (!review || review.fullName !== person.personal.fullName) return { status: 'unverified' };
    const state = review.status === 'pending' && review.expiresAt <= now() ? 'expired' : review.status;
    if (!['pending', 'verified', 'rejected', 'expired'].includes(state)) return { status: 'unverified' };
    return { status: state, idType: review.idType, submittedAt: review.submittedAt, reviewedAt: review.reviewedAt ?? null, reason: review.reason ?? '' };
  }
  async function account(uid) {
    const [person, role, review] = await Promise.all([profile(uid), store.get(`roles/${uid}`), store.get(`verifications/${uid}`)]);
    return { id: uid, username: person.username, personal: person.personal, verification: status(review, person), isReviewer: role?.reviewer === true, avatarVersion: person.avatar?.version ?? null };
  }
  async function peer(uid, tx = store) {
    const person = await profile(uid, tx); const review = await tx.get(`verifications/${uid}`);
    return { id: uid, name: person.personal.fullName, initials: initials(person.personal.fullName), city: person.personal.city, verified: status(review, person).status === 'verified' };
  }
  async function seller(uid, tx = store) {
    const person = await profile(uid, tx); const review = await tx.get(`verifications/${uid}`);
    if (status(review, person).status !== 'verified') throw new BackendError('Submit a valid government photo ID and wait for approval before publishing livestock.', 403); return person;
  }
  return { profile, status, account, peer, seller };
}
