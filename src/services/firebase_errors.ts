import { ApiError } from './api_error';

export function firebaseError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const code = (error as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/user-not-found': 'The email or password is incorrect.',
    'auth/email-already-in-use': 'This email is registered. Sign in with its password.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Use 8–21 characters with uppercase, lowercase, a number, and a special symbol.',
    'auth/password-does-not-meet-requirements': 'Your password does not meet the required password rules.',
    'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
    'auth/network-request-failed': 'Unable to connect to Firebase. Check your connection and retry.',
    'auth/operation-not-allowed': 'Email/password login must be enabled in this Firebase project.',
    'auth/requires-recent-login': 'Sign in again before changing your account security.',
    'auth/user-disabled': 'This account is disabled. Contact the administrator.',
    'permission-denied': 'Firestore denied this action. The project owner must publish the account security rules.',
    'resource-exhausted': 'The free database quota has been reached. Please try again after it resets.',
    'unavailable': 'Firebase is temporarily unavailable. Check your connection and retry.',
    'failed-precondition': 'Firestore needs its database or required indexes configured.',
  };
  return new ApiError(messages[code] ?? (error instanceof Error ? error.message : 'Unable to complete your Firebase request.'), code === 'permission-denied' ? 403 : 0);
}
