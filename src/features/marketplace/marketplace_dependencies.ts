import { createMarketplaceService } from './application/marketplace_service';
import { mockListingRepository } from './data/mock_listing_repository';
import { createSellerListingsService } from './application/seller_listings_service';
import { mockSellerListings } from './data/mock_seller_listings';
import { filterListings, type Listing, type ListingCriteria } from './domain/listing';
import { checkSellerEligibility, getAccountSnapshot } from '../profile/profile_store';

/** The app's current catalog wiring. Replace the repository when a real API is available. */
export const sellerListingsService = createSellerListingsService(mockSellerListings);
// Private storage is consulted only when creating an order, never for public catalog rendering.
// A production repository must authorize buyer/seller access on the server.
export const getOrderPickupPin = (listingId: string) => mockListingRepository.getPickupPin(listingId);
const catalogService = createMarketplaceService(mockListingRepository);
function visibleCatalog(): Listing[] {
  const owned = new Map(sellerListingsService.getSnapshot().map((item) => [item.id, item]));
  return mockListingRepository.getAll().flatMap((listing) => {
    // Published seller entries use the catalog's generated ID. Removed or paused entries stay private.
    if (!listing.id.startsWith('seller-')) return [listing];
    const sellerListing = owned.get(listing.id);
    const account = getAccountSnapshot();
    const verified = listing.seller?.id === account.userId ? account.verification.status === 'verified' : listing.verified;
    return sellerListing?.status === 'active' ? [{ ...listing, price: sellerListing.price, verified }] : [];
  });
}
export const marketplaceService = {
  ...catalogService,
  findListings: (criteria: ListingCriteria) => filterListings(visibleCatalog(), criteria),
  getListing: (id: string) => id.startsWith('seller-') ? visibleCatalog().find((item) => item.id === id) : catalogService.getListing(id),
  publishListing: async (...args: Parameters<typeof catalogService.publishListing>) => {
    let account = getAccountSnapshot();
    if (!account.signedIn) throw new Error('Sign in to publish your listing.');
    account = await checkSellerEligibility();
    const listing = await catalogService.publishListing({ ...args[0], verified: true, seller: { id: account.userId, name: account.personal.fullName, memberSince: '2026' } }, args[1]);
    sellerListingsService.addPublished(listing);
    return listing;
  },
};
