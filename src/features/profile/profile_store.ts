import { useSyncExternalStore } from 'react';

import { DAVAO_DEL_NORTE, isDavaoDelNorteLocality, type DavaoDelNorteLocality } from '@/constants/davao_del_norte';

export type PersonalInformation = {
  fullName: string;
  email: string;
  phone: string;
  city: DavaoDelNorteLocality;
};

type AccountSnapshot = {
  signedIn: boolean;
  username: string;
  personal: PersonalInformation;
};

const listeners = new Set<() => void>();
let credentials: { username: string; password: string } | null = null;
let snapshot: AccountSnapshot = {
  signedIn: false,
  username: '',
  personal: { fullName: '', email: '', phone: '', city: 'Tagum City' },
};

function publish(next: AccountSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAccount() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function signIn(username: string, password: string): string | null {
  const normalized = username.trim();
  if (credentials && (credentials.username !== normalized || credentials.password !== password)) {
    return 'Username or password does not match this demo account.';
  }
  if (!credentials) {
    credentials = { username: normalized, password };
  }
  const displayName = normalized.includes('@') ? normalized.split('@')[0] : normalized;
  publish({
    ...snapshot,
    signedIn: true,
    username: normalized,
    personal: { ...snapshot.personal, fullName: snapshot.personal.fullName || displayName },
  });
  return null;
}

export function signOut() {
  publish({ ...snapshot, signedIn: false });
}

export function validatePersonalInformation(personal: PersonalInformation): string | null {
  if (!personal.fullName.trim()) return 'Enter your full name.';
  if (personal.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email.trim())) return 'Enter a valid email address.';
  if (personal.phone && !/^[+\d\s()-]{7,20}$/.test(personal.phone.trim())) return 'Enter a valid phone number.';
  if (!isDavaoDelNorteLocality(personal.city)) return `Choose a city or municipality in ${DAVAO_DEL_NORTE}.`;
  return null;
}

export function savePersonalInformation(personal: PersonalInformation): string | null {
  const error = validatePersonalInformation(personal);
  if (error) return error;
  publish({
    ...snapshot,
    personal: {
      fullName: personal.fullName.trim(),
      email: personal.email.trim(),
      phone: personal.phone.trim(),
      city: personal.city,
    },
  });
  return null;
}

export function changePassword(current: string, next: string, confirmation: string): string | null {
  if (!snapshot.signedIn || !credentials) return 'Sign in before changing the demo password.';
  if (current !== credentials.password) return 'Current password is incorrect.';
  if (next.length < 8) return 'Use at least 8 characters for the new password.';
  if (next === current) return 'Choose a different password.';
  if (next !== confirmation) return 'New passwords do not match.';
  credentials = { ...credentials, password: next };
  return null;
}
