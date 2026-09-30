import { isDavaoDelNorteLocation } from '@/constants/davao_del_norte';
import { locationIssue } from '../../location/domain/location';

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
      const listing = repository.getById(id);
      return listing && isDavaoDelNorteLocation(listing.location) ? listing : undefined;
    },
    publishListing(input, pickupPin) {
      const pinIssue = locationIssue({ coordinate: pickupPin, address: null, source: 'map' });
      if (pinIssue) throw new Error(pinIssue);
      if (!isDavaoDelNorteLocation(input.location)) {
        throw new Error('Listings must be located in Davao del Norte.');
      }
      const listing = { ...input, id: `seller-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
      repository.add(listing, pickupPin);
      return listing;
    },
  };
}
