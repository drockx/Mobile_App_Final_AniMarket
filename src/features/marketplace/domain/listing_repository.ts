import type { Listing, PickupPin } from './listing';
import type { CollectionRepository } from '@/services/collection';

/** The catalog contract used by marketplace operations, regardless of storage. */
export interface ListingRepository extends CollectionRepository<Listing> {
  publish(ownerId: string, listing: Listing, pickupPin?: PickupPin): Promise<Listing>;
  loadPickupPin(listingId: string, buyerId: string): Promise<PickupPin | undefined>;
}
