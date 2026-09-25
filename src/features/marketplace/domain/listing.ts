export type LivestockCategory = 'Pig' | 'Cow' | 'Chicken' | 'Goat';

export type HealthVerification =
  | { status: 'verified'; note: string }
  | { status: 'unverified' };

export type Listing = {
  id: string;
  title: string;
  category: LivestockCategory;
  details: string;
  price: number;
  verified: boolean;
  location: string;
  subtitle?: string;
  weight: string;
  age: string;
  health: string;
  healthVerification: HealthVerification;
  description: string;
  seller?: { name: string; memberSince: string };
};

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
  return filtered;
}
