import type { FirebaseOptions } from 'firebase/app';

export const firebaseEnabled = process.env.EXPO_PUBLIC_BACKEND === 'firebase';

export function firebaseConfig(): FirebaseOptions {
  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error('Firebase login is not configured. Check the public Firebase settings and restart Expo.');
  }
  // Storage, Functions and Analytics are deliberately not initialized on the Spark plan.
  return config;
}
