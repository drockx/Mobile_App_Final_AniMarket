import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Persistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase_config';

export function createFirebaseServices(persistence?: Persistence) {
  const previous = getApps().find((app) => app.name === 'animarket');
  const app = previous ?? initializeApp(firebaseConfig(), 'animarket');
  const auth = previous || !persistence ? getAuth(app) : initializeAuth(app, { persistence });
  const firestore = initializeFirestore(app, { ignoreUndefinedProperties: true, experimentalAutoDetectLongPolling: true });
  return { app, auth, firestore };
}
