import type { ListingCriteria, LivestockCategory } from '../domain/listing';

export type SortOrder = 'newest' | 'price-asc' | 'price-desc';

export type SearchFilters = {
  query: string;
  category: LivestockCategory | null;
  location: string;
  minPrice: string;
  maxPrice: string;
  sort: SortOrder;
  verifiedOnly: boolean;
  vaccinatedOnly: boolean;
};

export const emptyFilters: SearchFilters = {
  query: '',
  category: null,
  location: '',
  minPrice: '',
  maxPrice: '',
  sort: 'newest',
  verifiedOnly: false,
  vaccinatedOnly: false,
};

export const featuredFilters: SearchFilters = {
  ...emptyFilters,
  category: 'Cow',
  location: 'Tagum City, Davao del Norte',
  minPrice: '10000',
  maxPrice: '60000',
  verifiedOnly: true,
  vaccinatedOnly: true,
};

export function numericPrice(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

export function toListingCriteria(filters: SearchFilters): ListingCriteria {
  return {
    category: filters.category,
    query: filters.query,
    verifiedOnly: filters.verifiedOnly,
    location: filters.location,
    minPrice: numericPrice(filters.minPrice),
    maxPrice: numericPrice(filters.maxPrice),
    vaccinatedOnly: filters.vaccinatedOnly,
    sort: filters.sort,
  };
}
