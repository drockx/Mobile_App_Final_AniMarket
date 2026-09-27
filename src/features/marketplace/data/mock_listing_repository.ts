import type { ListingRepository } from '../domain/listing_repository';
import type { Listing } from '../domain/listing';
import { listings } from './mock_listings';

const createdListings: Listing[] = [];

export const mockListingRepository: ListingRepository = {
  getAll: () => [...createdListings, ...listings],
  getById: (id) => createdListings.find((listing) => listing.id === id) ?? listings.find((listing) => listing.id === id),
  add: (listing) => { createdListings.unshift(listing); },
};
