import { createMemoryCollection } from '@/services/collection';
import type { ListingRepository } from '../domain/listing_repository';
import { sameListingDetails, type Listing, type PickupPin } from '../domain/listing';

export function createLocalListingRepository(initial: readonly Listing[] = []): ListingRepository {
  const collection = createMemoryCollection(initial);
  const pins = new Map<string, PickupPin>();
  const catalog = new Map(initial.map((item) => [item.id, item]));
  function requireOwner(ownerId: string, listing: Listing | undefined) {
    if (!ownerId || !listing || listing.seller?.id !== ownerId) throw new Error('This listing is unavailable for your account.');
  }
  return {
    watch: (scope, receive, fail) => collection.watch(scope, (items) => receive(items.filter((item) => scope === 'public'
      ? (item.status ?? 'active') === 'active' : item.seller?.id === scope)), fail),
    async publish(ownerId, listing, pickupPin) {
      requireOwner(ownerId, listing);
      const existing = catalog.get(listing.id);
      if (existing) {
        requireOwner(ownerId, existing);
        if (existing.status !== 'draft') {
          if (listing.status === 'active' && sameListingDetails(existing, listing)
            && JSON.stringify(pins.get(listing.id)) === JSON.stringify(pickupPin)) return existing;
          throw new Error('This listing has already been published. Open My Listings to review it.');
        }
      }
      const saved = await collection.save(ownerId, { ...listing, createdAt: existing?.createdAt ?? listing.createdAt });
      catalog.set(saved.id, saved);
      if (pickupPin) pins.set(saved.id, { ...pickupPin }); else pins.delete(saved.id);
      return saved;
    },
    async save(ownerId, listing) {
      requireOwner(ownerId, catalog.get(listing.id)); requireOwner(ownerId, listing);
      const saved = await collection.save(ownerId, listing); catalog.set(saved.id, saved); return saved;
    },
    async remove(ownerId, id) {
      requireOwner(ownerId, catalog.get(id));
      await collection.remove(ownerId, id); catalog.delete(id); pins.delete(id);
    },
    async loadPickupPin(id, buyerId) {
      if (!buyerId) throw new Error('Sign in to choose a pickup point.');
      const pin = pins.get(id); return pin ? { ...pin } : undefined;
    },
  };
}
