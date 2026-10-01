import type { MarketplaceService } from './marketplace_service';
import type { SellerListing } from '../domain/seller_listing';

export function createSellerListingsService(marketplace: MarketplaceService) {
  let snapshot: readonly SellerListing[] = [];
  function update() {
    snapshot = marketplace.getOwnedSnapshot().map((listing) => ({
      id: listing.id, title: listing.title || `${listing.category} draft`, category: listing.category, status: listing.status ?? 'active',
      price: listing.price, unit: listing.priceUnit ?? 'per head', details: listing.details,
      weight: listing.weight.replace(/\s*kg$/i, ''), location: listing.location.replace(', Davao del Norte', ''),
      views: listing.views ?? 0, inquiries: listing.inquiries ?? 0,
      updated: listing.updatedAt ? new Date(listing.updatedAt).toLocaleDateString() : 'Date unavailable',
      notice: listing.status === 'paused' ? 'This listing is hidden from the marketplace.' : '', imageUri: listing.imageUri,
    }));
  }
  marketplace.subscribeOwned(update); update();
  return {
    getSnapshot: () => snapshot, subscribe: marketplace.subscribeOwned,
    getState: marketplace.getOwnedState, retry: marketplace.retryOwned,
    updatePrice: marketplace.updatePrice, setPaused: marketplace.setPaused, remove: marketplace.remove,
  };
}
export type SellerListingsService = ReturnType<typeof createSellerListingsService>;
