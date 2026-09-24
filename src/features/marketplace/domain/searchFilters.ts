import type { LivestockCategory } from './listing';

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

type FilterParams = Partial<Record<keyof SearchFilters | 'applied', string | string[]>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseSearchFilters(params: FilterParams): SearchFilters {
  const category = first(params.category);
  const sort = first(params.sort);
  return {
    query: first(params.query) ?? '',
    category: category === 'Cow' || category === 'Goat' || category === 'Pig'
      || category === 'Chicken' || category === 'Supply' ? category : null,
    location: first(params.location) ?? '',
    minPrice: first(params.minPrice) ?? '',
    maxPrice: first(params.maxPrice) ?? '',
    sort: sort === 'price-asc' || sort === 'price-desc' ? sort : 'newest',
    verifiedOnly: first(params.verifiedOnly) === 'true',
    vaccinatedOnly: first(params.vaccinatedOnly) === 'true',
  };
}

export function serializeSearchFilters(filters: SearchFilters): Record<string, string> {
  return {
    applied: 'true',
    query: filters.query,
    category: filters.category ?? '',
    location: filters.location,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    sort: filters.sort,
    verifiedOnly: String(filters.verifiedOnly),
    vaccinatedOnly: String(filters.vaccinatedOnly),
  };
}

export function numericPrice(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}
