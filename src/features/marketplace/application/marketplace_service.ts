import { filterListings, type Listing, type ListingCriteria } from '../domain/listing';
import type { ListingRepository } from '../domain/listing_repository';

export type MarketplaceService = {
  findListings(criteria: ListingCriteria): Listing[];
  getListing(id: string): Listing | undefined;
};

export function createMarketplaceService(repository: ListingRepository): MarketplaceService {
  return {
    findListings(criteria) {
      return filterListings(repository.getAll(), criteria);
    },
    getListing(id) {
      return repository.getById(id);
    },
  };
}
