import type { SellerListing } from '../domain/seller_listing';

// Seller-management fixtures, separate from the public marketplace catalog.
export const mockSellerListings: SellerListing[] = [
  { id: 'ANM-L-0148', title: 'Brahman Bull (Pure Breed)', category: 'Cow', status: 'active', price: 45000, unit: 'per head', details: '450 kg • Vaccinated', weight: '450', location: 'Tagum City', views: 128, inquiries: 3, updated: 'Today', notice: '3 buyers are waiting for your reply.' },
  { id: 'ANM-L-0164', title: 'Native Goat', category: 'Goat', status: 'active', price: 12500, unit: 'per head', details: '38 kg • Vaccination proof attached', weight: '38', location: 'Panabo City', views: 76, inquiries: 2, updated: 'Yesterday', notice: '2 unread buyer inquiries.' },
  { id: 'ANM-L-0181', title: 'Landrace Market Hogs (10)', category: 'Pig', status: 'draft', price: 145, unit: 'per kg', details: 'Estimated 95 kg each • 10 heads', weight: '95', location: 'Kapalong', views: 0, inquiries: 0, updated: 'Sep 20', notice: 'Add vaccination proof before publishing.' },
  { id: 'ANM-L-0122', title: 'Anglo-Nubian Goats (5)', category: 'Goat', status: 'paused', price: 6500, unit: 'per head', details: '5 heads • Seller paused listing', weight: '', location: 'Tagum City', views: 94, inquiries: 0, updated: 'Sep 18', notice: 'This listing is hidden from the marketplace.' },
  { id: 'ANM-L-0097', title: 'Native Chickens (10)', category: 'Chicken', status: 'sold', price: 8500, unit: 'total', details: '10 heads • Completed order', weight: '', location: 'Island Garden City of Samal', views: 210, inquiries: 8, updated: 'Sep 8', notice: 'Sold through order ANM-2026-148026.', orderId: 'ANM-2026-148026' },
];
