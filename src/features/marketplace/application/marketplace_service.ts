import { isDavaoDelNorteLocation } from '@/constants/davao_del_norte';
import { createCollectionStore } from '@/services/collection';
import { createRecordId } from '@/services/development_data';
import { locationIssue } from '../../location/domain/location';
import { filterListings, isListingRecord, type Listing, type ListingCriteria, type PickupPin } from '../domain/listing';
import type { ListingRepository } from '../domain/listing_repository';

export function createMarketplaceService(repository: ListingRepository) {
  let ownerId = '';
  const catalog = createCollectionStore(repository, (listing) => isListingRecord(listing) && (listing.status ?? 'active') === 'active');
  const owned = createCollectionStore(repository, (listing) => isListingRecord(listing) && listing.seller?.id === ownerId);
  catalog.connect('public');
  function requireOwned(id: string) {
    const listing = owned.getSnapshot().find((item) => item.id === id);
    if (!ownerId || !listing || listing.seller?.id !== ownerId) throw new Error('This listing is no longer available for your account.');
    return listing;
  }
  return {
    subscribe: catalog.subscribe, getSnapshot: catalog.getSnapshot, getState: catalog.getState, retry: catalog.retry,
    subscribeOwned: owned.subscribe, getOwnedSnapshot: owned.getSnapshot, getOwnedState: owned.getState, retryOwned: owned.retry,
    connectOwner(id: string) { ownerId = id; owned.connect(id || null); },
    findListings: (criteria: ListingCriteria) => filterListings(catalog.getSnapshot(), criteria),
    getListing: (id: string) => catalog.getSnapshot().find((listing) => listing.id === id && isDavaoDelNorteLocation(listing.location)),
    async publishListing(input: Omit<Listing, 'id'>, pickupPin: PickupPin, draftId?: string, operationId?: string): Promise<Listing> {
      const pinIssue = locationIssue({ coordinate: pickupPin, address: null, source: 'map' });
      if (pinIssue) throw new Error(pinIssue);
      if (!isDavaoDelNorteLocation(input.location)) throw new Error('Listings must be located in Davao del Norte.');
      if (!ownerId || input.seller?.id !== ownerId) throw new Error('Sign in to publish your listing.');
      if (!input.title.trim() || !Number.isFinite(input.price) || input.price <= 0) throw new Error('Enter a title and a valid price.');
      const currentOwner = ownerId;
      const draft = draftId ? requireOwned(draftId) : undefined;
      if (draft && draft.status !== 'draft' && draft.status !== 'active') throw new Error('This draft is no longer available to publish.');
      const now = new Date().toISOString();
      const record = { ...input, id: draftId ?? operationId ?? createRecordId(), status: 'active' as const, createdAt: draft?.createdAt ?? now, updatedAt: now };
      if (!isListingRecord(record)) throw new Error('The listing details are incomplete. Please review them.');
      const listing = await repository.publish(currentOwner, record, pickupPin);
      if (currentOwner !== ownerId) throw new Error('Your account changed. Please sign in again.');
      owned.acceptConfirmed(listing, draft); catalog.acceptConfirmed(listing);
      return listing;
    },
    async saveDraft(input: Omit<Listing, 'id'>, pickupPin?: PickupPin, draftId?: string, operationId?: string): Promise<Listing> {
      if (!ownerId || input.seller?.id !== ownerId) throw new Error('Sign in to save your draft.');
      const previous = draftId ? requireOwned(draftId) : undefined;
      if (previous && previous.status !== 'draft') throw new Error('This listing is no longer a draft.');
      if (pickupPin) {
        const issue = locationIssue({ coordinate: pickupPin, address: null, source: 'map' });
        if (issue) throw new Error(issue);
      }
      const currentOwner = ownerId;
      const now = new Date().toISOString();
      const record: Listing = { ...input, id: draftId ?? operationId ?? createRecordId(), status: 'draft', createdAt: previous?.createdAt ?? now, updatedAt: now };
      if (!isListingRecord(record)) throw new Error('Check the draft details and price.');
      const saved = await repository.publish(currentOwner, record, pickupPin);
      if (currentOwner !== ownerId) throw new Error('Your account changed. Please try again.');
      owned.acceptConfirmed(saved, previous);
      return saved;
    },
    async updatePrice(id: string, price: number) {
      if (!Number.isFinite(price) || price <= 0) throw new Error('Enter a price greater than zero.');
      const previous = catalog.getSnapshot().find((item) => item.id === id);
      const saved = await owned.save({ ...requireOwned(id), price, updatedAt: new Date().toISOString() });
      if ((saved.status ?? 'active') === 'active') catalog.acceptConfirmed(saved, previous);
      return true;
    },
    async setPaused(id: string, paused: boolean) {
      const listing = requireOwned(id);
      if (listing.status && listing.status !== 'active' && listing.status !== 'paused') throw new Error('Only active or paused listings can be changed.');
      const previous = catalog.getSnapshot().find((item) => item.id === id);
      const saved = await owned.save({ ...listing, status: paused ? 'paused' : 'active', updatedAt: new Date().toISOString() });
      if (paused) catalog.dropConfirmed(id, previous); else catalog.acceptConfirmed(saved, previous);
    },
    async remove(id: string) {
      requireOwned(id); const previous = catalog.getSnapshot().find((item) => item.id === id);
      await owned.remove(id); catalog.dropConfirmed(id, previous);
    },
    loadPickupPin: (id: string, buyerId: string) => repository.loadPickupPin(id, buyerId),
  };
}
export type MarketplaceService = ReturnType<typeof createMarketplaceService>;
