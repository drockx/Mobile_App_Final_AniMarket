export function createRecordId() {
  // IDs are opaque: routes and ownership never depend on their format.
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
