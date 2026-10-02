import { where } from './firestore.mjs';
/** Hourly cleanup uses bounded indexed queries, including accounts that no longer open the app. */
export function createMaintenance({ store, media, calls, now = Date.now }) {
  return async () => {
    const result = { ids: 0, uploads: 0, calls: 0, retries: 0 };
    const ids = await store.query('verifications', [where('expiresAt', now(), 'LESS_THAN_OR_EQUAL')], { limit: 40 });
    for (const entry of ids) {
      const old = await store.transact(async (tx) => { const current = await tx.get(`verifications/${entry.userId}`); if (!current?.photoPath || current.expiresAt > now()) return null; tx.set(`verifications/${entry.userId}`, { ...current, status: 'expired', photoPath: null, expiresAt: null, reason: 'Your ID submission expired. Submit a new photo.' }); return current; });
      if (!old) continue;
      try { await media.privateDelete('animarket-ids', old.photoPath); } catch { await store.transact(async (tx) => tx.set(`mediaCleanup/${old.submissionId}`, { id: old.submissionId, bucket: 'animarket-ids', path: old.photoPath, expiresAt: now() })); } result.ids++;
    }
    const uploads = await store.query('uploads', [where('expiresAt', now(), 'LESS_THAN_OR_EQUAL')], { limit: 40 });
    for (const entry of uploads) {
      // Expiry and reattachment are serialized. Claim before touching the remote object.
      const claimed = await store.transact(async (tx) => { const current = await tx.get(`uploads/${entry.id}`); if (!current || current.refs.length || current.expiresAt == null || current.expiresAt > now()) return null; tx.set(`uploads/${entry.id}`, { ...current, deleting: true }); return current; });
      if (!claimed) continue;
      try { if (claimed.publicId) await media.deletePublic(claimed.publicId); else await media.privateDelete(claimed.bucket, claimed.path); await store.transact(async (tx) => tx.delete(`uploads/${claimed.id}`)); result.uploads++; } catch { /* Keep the claimed record for the next cleanup attempt. */ }
    }
    const expiredCalls = await store.query('voiceCalls', [where('expiresAt', now(), 'LESS_THAN_OR_EQUAL')], { limit: 20 });
    for (const entry of expiredCalls) await store.transact(async (tx) => { const current = await tx.get(`voiceCalls/${entry.id}`); if (calls.stale(current)) { await calls.finish(tx, current, current.status === 'ringing' ? 'missed' : 'ended', 'connection-timeout'); result.calls++; } });
    const cleanup = await store.query('mediaCleanup', [], { limit: 40 });
    for (const entry of cleanup) { try { if (entry.publicId) await media.deletePublic(entry.publicId); else await media.privateDelete(entry.bucket, entry.path); await store.transact(async (tx) => tx.delete(`mediaCleanup/${entry.id}`)); result.retries++; } catch { /* Retain the cleanup job until remote deletion succeeds. */ } }
    return result;
  };
}
