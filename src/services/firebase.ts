import { createFirebaseServices } from './firebase_bootstrap';

let services: ReturnType<typeof createFirebaseServices> | undefined;
export function getFirebaseServices() { return services ??= createFirebaseServices(); }
