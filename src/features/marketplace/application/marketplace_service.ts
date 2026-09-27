import { filterListings, type Listing, type ListingCriteria, type PickupPin } from '../domain/listing';
import type { ListingRepository } from '../domain/listing_repository';

export type MarketplaceService = {
  findListings(criteria: ListingCriteria): Listing[];
  getListing(id: string): Listing | undefined;
  publishListing(listing: Omit<Listing, 'id'>, pickupPin: PickupPin): Listing;
};

export function createMarketplaceService(repository: ListingRepository): MarketplaceService {
  return {
    findListings(criteria) {
      return filterListings(repository.getAll(), criteria);
    },
    getListing(id) {
      return repository.getById(id);
    },
    publishListing(input, pickupPin) {
      const listing = { ...input, id: `seller-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
      repository.add(listing, pickupPin);
      return listing;
    },
  };
}
