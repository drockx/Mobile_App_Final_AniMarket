import type { Listing } from '../domain/listing';
import type { SellerListing } from '../domain/seller_listing';

export function createSellerListingsService(initial: readonly SellerListing[]) {
  let snapshot = initial.map((listing) => ({ ...listing }));
  const listeners = new Set<() => void>();
  function publish(next: SellerListing[]) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    updatePrice(id: string, price: number) {
      if (!Number.isFinite(price) || price <= 0) return false;
      publish(snapshot.map((item) => item.id === id ? { ...item, price, updated: 'Just now' } : item));
      return true;
    },
    setPaused(id: string, paused: boolean) {
      publish(snapshot.map((item) => item.id === id && (item.status === 'active' || item.status === 'paused')
        ? { ...item, status: paused ? 'paused' : 'active', updated: 'Just now', notice: paused ? 'This listing is hidden from the marketplace.' : 'Listing is visible in the marketplace.' } : item));
    },
    remove(id: string) { publish(snapshot.filter((item) => item.id !== id)); },
    addPublished(listing: Listing) {
      publish([{ id: listing.id, title: listing.title, category: listing.category, status: 'active', price: listing.price, unit: listing.priceUnit ?? 'per head', details: listing.details, weight: listing.weight.replace(/\s*kg$/i, ''), location: listing.location.replace(', Davao del Norte', ''), views: 0, inquiries: 0, updated: 'Just now', notice: 'Listing is visible in the marketplace.', imageUri: listing.imageUri }, ...snapshot]);
    },
  };
}

export type SellerListingsService = ReturnType<typeof createSellerListingsService>;
