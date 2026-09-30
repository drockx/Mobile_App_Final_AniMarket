import type { Listing, PickupPin } from './listing';

/** The catalog contract used by marketplace operations, regardless of storage. */
export interface ListingRepository {
  getAll(): readonly Listing[];
  getById(id: string): Listing | undefined;
  add(listing: Listing, pickupPin: PickupPin): void;
  getPickupPin(id: string): PickupPin | undefined;
}
