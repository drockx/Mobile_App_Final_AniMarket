import type { ListingRepository } from '../domain/listing_repository';
import { listings } from './mock_listings';

export const mockListingRepository: ListingRepository = {
  getAll: () => listings,
  getById: (id) => listings.find((listing) => listing.id === id),
};
