export type LivestockCategory = 'Pig' | 'Cow' | 'Chicken' | 'Goat' | 'Supply';

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

export function filterListings(
  listings: Listing[],
  category: LivestockCategory | null,
  query: string,
  verifiedOnly: boolean,
  options: {
    location?: string;
    minPrice?: number;
    maxPrice?: number;
    vaccinatedOnly?: boolean;
    sort?: 'newest' | 'price-asc' | 'price-desc';
  } = {},
): Listing[] {
  const search = query.trim().toLowerCase();

  const filtered = listings.filter((listing) => {
    const matchesCategory = category === null || listing.category === category;
    const matchesSearch = !search || `${listing.title} ${listing.category} ${listing.details}`.toLowerCase().includes(search);
    const matchesLocation = !options.location || listing.location === options.location;
    const matchesMinPrice = options.minPrice === undefined || listing.price >= options.minPrice;
    const matchesMaxPrice = options.maxPrice === undefined || listing.price <= options.maxPrice;
    const matchesVaccination = !options.vaccinatedOnly || listing.health === 'Vaccinated';
    return matchesCategory && matchesSearch && matchesLocation && matchesMinPrice && matchesMaxPrice
      && matchesVaccination && (!verifiedOnly || listing.verified);
  });

  if (options.sort === 'price-asc') return filtered.sort((a, b) => a.price - b.price);
  if (options.sort === 'price-desc') return filtered.sort((a, b) => b.price - a.price);
  return filtered;
}
