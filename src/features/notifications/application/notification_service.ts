import { createCollectionStore, type CollectionRepository } from '@/services/collection';
import type { AppNotification, NotificationRead } from '../notification_store';

export function createNotificationStore(repository: CollectionRepository<NotificationRead>) {
  const reads = createCollectionStore(repository);
  let ownerId = '';
  let events: readonly AppNotification[] = [];
  let snapshot: readonly AppNotification[] = [];
  const listeners = new Set<() => void>();
  function publish() {
    const seen = new Set(reads.getSnapshot().map((item) => item.eventId));
    snapshot = events.map((item) => ({ ...item, unread: item.unread && !seen.has(item.id) }));
    listeners.forEach((listener) => listener());
  }
  reads.subscribe(publish);
  return {
    connectOwner(id: string) { if (id === ownerId) return; ownerId = id; events = []; reads.connect(id || null); publish(); },
    replaceEvents(next: readonly AppNotification[]) { events = ownerId ? next : []; publish(); },
    getSnapshot: () => snapshot, getState: reads.getState, retry: reads.retry,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async markRead(id: string) {
      if (!events.some((item) => item.id === id)) throw new Error('This notification is no longer available.');
      await reads.save({ id: `${ownerId}:${id}`, eventId: id, ownerId });
    },
    async markAllRead() {
      const currentOwner = ownerId;
      // One record per event permits idempotent retries after a partially failed batch.
      for (const item of snapshot.filter((entry) => entry.unread)) {
        if (currentOwner !== ownerId) throw new Error('Your account changed. Please try again.');
        await reads.save({ id: `${currentOwner}:${item.id}`, eventId: item.id, ownerId: currentOwner });
      }
    },
  };
}

