import type { ListingRepository } from '../domain/listing_repository';
import type { Listing, PickupPin } from '../domain/listing';
import { listings } from './mock_listings';

const createdListings: Listing[] = [];
// Kept outside the public listing model. An order service can expose this only after authorization.
const orderOnlyPickupPins = new Map<string, PickupPin>();

export const mockListingRepository: ListingRepository = {
  getAll: () => [...createdListings, ...listings],
  getById: (id) => createdListings.find((listing) => listing.id === id) ?? listings.find((listing) => listing.id === id),
  add: (listing, pickupPin) => {
    orderOnlyPickupPins.set(listing.id, pickupPin);
    createdListings.unshift(listing);
  },
};
