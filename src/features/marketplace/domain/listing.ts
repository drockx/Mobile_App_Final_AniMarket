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

export function filterListings(
  listings: Listing[],
  category: LivestockCategory | null,
  query: string,
  verifiedOnly: boolean,
): Listing[] {
  const search = query.trim().toLowerCase();

  return listings.filter((listing) => {
    const matchesCategory = category === null || listing.category === category;
    const matchesSearch = !search || `${listing.title} ${listing.category} ${listing.details}`.toLowerCase().includes(search);
    return matchesCategory && matchesSearch && (!verifiedOnly || listing.verified);
  });
}
