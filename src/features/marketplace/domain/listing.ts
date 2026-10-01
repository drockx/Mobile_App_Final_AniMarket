import { isDavaoDelNorteLocation } from '@/constants/davao_del_norte';

export type LivestockCategory = 'Pig' | 'Cow' | 'Chicken' | 'Goat';
export type ListingPriceUnit = 'per head' | 'per kg' | 'total';

export type HealthVerification =
  | { status: 'verified'; note: string }
  | { status: 'unverified' };

export type Listing = {
  id: string;
  status?: 'active' | 'draft' | 'paused' | 'sold';
  createdAt?: string;
  updatedAt?: string;
  views?: number;
  inquiries?: number;
  title: string;
  category: LivestockCategory;
  details: string;
  price: number;
  priceUnit?: ListingPriceUnit;
  verified: boolean;
  location: string;
  streetPurok?: string;
  barangay?: string;
  subtitle?: string;
  weight: string;
  age: string;
  health: string;
  healthVerification: HealthVerification;
  description: string;
  imageUri?: string;
  imageUris?: string[];
  vaccinationProof?: { name: string; uri: string };
  vaccinationDate?: string;
  vaccineName?: string;
  seller?: { id?: string; name: string; memberSince: string; phone?: string };
};

export type PickupPin = { latitude: number; longitude: number };

export function sameListingDetails(left: Listing, right: Listing): boolean {
  const fields: (keyof Listing)[] = ['title', 'category', 'price', 'priceUnit', 'location', 'streetPurok', 'barangay', 'weight', 'age', 'health', 'description', 'imageUri', 'imageUris', 'vaccinationProof', 'vaccinationDate', 'vaccineName'];
  return left.seller?.id === right.seller?.id && fields.every((key) => JSON.stringify(left[key]) === JSON.stringify(right[key]));
}

export function isListingRecord(listing: Listing): boolean {
  return typeof listing.title === 'string' && ['Cow', 'Pig', 'Goat', 'Chicken'].includes(listing.category)
    && typeof listing.location === 'string' && Number.isFinite(listing.price) && (listing.status === 'draft' ? listing.price >= 0 : listing.price > 0)
    && ['details', 'weight', 'age', 'health', 'description'].every((key) => typeof listing[key as keyof Listing] === 'string')
    && typeof listing.verified === 'boolean' && !!listing.healthVerification
    && ['verified', 'unverified'].includes(listing.healthVerification.status)
    && (!listing.status || ['active', 'draft', 'paused', 'sold'].includes(listing.status))
    && (!listing.imageUris || (Array.isArray(listing.imageUris) && listing.imageUris.every((uri) => typeof uri === 'string')))
    && (!listing.seller || (typeof listing.seller.name === 'string' && typeof listing.seller.memberSince === 'string'));
}

export function formatListingAddress(listing: Listing): string {
  return [listing.streetPurok, listing.barangay, listing.location].filter(Boolean).join(', ');
}

export type ListingCriteria = {
  category: LivestockCategory | null;
  query: string;
  verifiedOnly: boolean;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  vaccinatedOnly?: boolean;
  sort?: 'newest' | 'price-asc' | 'price-desc';
};

export function filterListings(
  listings: readonly Listing[],
  criteria: ListingCriteria,
): Listing[] {
  const search = criteria.query.trim().toLowerCase();

  const filtered = listings.filter((listing) => {
    if (!isDavaoDelNorteLocation(listing.location)) return false;
    const matchesCategory = criteria.category === null || listing.category === criteria.category;
    const matchesSearch = !search || `${listing.title} ${listing.category} ${listing.details}`.toLowerCase().includes(search);
    const matchesLocation = !criteria.location || listing.location === criteria.location;
    const matchesMinPrice = criteria.minPrice === undefined || listing.price >= criteria.minPrice;
    const matchesMaxPrice = criteria.maxPrice === undefined || listing.price <= criteria.maxPrice;
    const matchesVaccination = !criteria.vaccinatedOnly || listing.health === 'Vaccinated';
    return matchesCategory && matchesSearch && matchesLocation && matchesMinPrice && matchesMaxPrice
      && matchesVaccination && (!criteria.verifiedOnly || listing.verified);
  });

  if (criteria.sort === 'price-asc') return filtered.sort((a, b) => a.price - b.price);
  if (criteria.sort === 'price-desc') return filtered.sort((a, b) => b.price - a.price);
  if (criteria.sort === 'newest') return filtered.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return filtered;
}
