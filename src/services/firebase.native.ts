import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FirebaseAuth from 'firebase/auth';
import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';
import { createFirebaseServices } from './firebase_bootstrap';

let services: ReturnType<typeof createFirebaseServices> | undefined;
// Firebase 12 exposes this API from its native runtime entry point; its shared
// declaration file omits the native-only export. Keep that distinction local.
const nativeAuth = FirebaseAuth as typeof FirebaseAuth & { getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence };
export function getFirebaseServices() { return services ??= createFirebaseServices(nativeAuth.getReactNativePersistence(AsyncStorage)); }
