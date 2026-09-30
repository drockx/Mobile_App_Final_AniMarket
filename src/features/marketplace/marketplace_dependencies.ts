import { createMarketplaceService } from './application/marketplace_service';
import { mockListingRepository } from './data/mock_listing_repository';
import { createSellerListingsService } from './application/seller_listings_service';
import { mockSellerListings } from './data/mock_seller_listings';
import { filterListings, type Listing, type ListingCriteria } from './domain/listing';

/** The app's current catalog wiring. Replace the repository when a real API is available. */
export const sellerListingsService = createSellerListingsService(mockSellerListings);
const catalogService = createMarketplaceService(mockListingRepository);
function visibleCatalog(): Listing[] {
  const owned = new Map(sellerListingsService.getSnapshot().map((item) => [item.id, item]));
  return mockListingRepository.getAll().flatMap((listing) => {
    // Published seller entries use the catalog's generated ID. Removed or paused entries stay private.
    if (!listing.id.startsWith('seller-')) return [listing];
    const sellerListing = owned.get(listing.id);
    return sellerListing?.status === 'active' ? [{ ...listing, price: sellerListing.price }] : [];
  });
}
export const marketplaceService = {
  ...catalogService,
  findListings: (criteria: ListingCriteria) => filterListings(visibleCatalog(), criteria),
  getListing: (id: string) => id.startsWith('seller-') ? visibleCatalog().find((item) => item.id === id) : catalogService.getListing(id),
  publishListing: (...args: Parameters<typeof catalogService.publishListing>) => {
    const listing = catalogService.publishListing(...args);
    sellerListingsService.addPublished(listing);
    return listing;
  },
};
