import { featuredFilters, type SearchFilters } from './search_filters';

export type FilterParams = Partial<Record<keyof SearchFilters | 'applied', string | string[]>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseSearchFilters(params: FilterParams): SearchFilters {
  const category = first(params.category);
  const sort = first(params.sort);
  return {
    query: first(params.query) ?? '',
    category: category === 'Cow' || category === 'Goat' || category === 'Pig'
      || category === 'Chicken' ? category : null,
    location: first(params.location) ?? '',
    minPrice: first(params.minPrice) ?? '',
    maxPrice: first(params.maxPrice) ?? '',
    sort: sort === 'price-asc' || sort === 'price-desc' ? sort : 'newest',
    verifiedOnly: first(params.verifiedOnly) === 'true',
    vaccinatedOnly: first(params.vaccinatedOnly) === 'true',
  };
}

export function initialSearchFilters(params: FilterParams): SearchFilters {
  const incoming = parseSearchFilters(params);
  if (first(params.applied) === 'true') return incoming;
  return {
    ...featuredFilters,
    query: incoming.query,
    category: incoming.category ?? featuredFilters.category,
    verifiedOnly: params.verifiedOnly === undefined ? featuredFilters.verifiedOnly : incoming.verifiedOnly,
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
