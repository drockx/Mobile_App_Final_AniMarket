// Set EXPO_PUBLIC_SAMPLE_DATA=false to exercise the app with no sample records.
// Production builds start empty. Connecting a remote provider is a separate, explicit step.
export const useSampleData = typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_SAMPLE_DATA !== 'false';

export function createRecordId() {
  // IDs are opaque: routes and ownership never depend on their format.
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
