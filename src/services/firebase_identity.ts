import type { User } from 'firebase/auth';
import { ApiError } from './api_error';
import { getFirebaseServices } from './firebase';

export function requireFirebaseUser(expectedToken?: string | null): User {
  const user = getFirebaseServices().auth.currentUser;
  if (!user || (expectedToken !== undefined && expectedToken !== `firebase:${user.uid}`)) throw new ApiError('Your account changed. Sign in again.', 401);
  return user;
}
