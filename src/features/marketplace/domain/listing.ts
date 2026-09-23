export type LivestockCategory = 'Pig' | 'Cow' | 'Chicken' | 'Goat';

export type Listing = {
  id: string;
  title: string;
  category: LivestockCategory;
  details: string;
  price: number;
  image: number;
  verified: boolean;
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
