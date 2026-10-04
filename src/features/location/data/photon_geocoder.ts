import { isCoordinate, listingLocality, normalizedProvince, type LocationAddress, type LocationResult } from '../domain/location';
import type { Geocoder } from '../domain/location_provider';
import { DAVAO_DEL_NORTE_BOUNDS, isInsideDavaoDelNorte } from '../domain/davao_del_norte_geofence';

export function parsePhotonResults(data: unknown): LocationResult[] {
  const features = (data as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) throw new Error('Address search returned an invalid response. Please try again.');
  return features.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const feature = value as { geometry?: { coordinates?: unknown[] }; properties?: Record<string, unknown> };
    const coordinates = feature.geometry?.coordinates;
    const coordinate = { latitude: coordinates?.[1] as number, longitude: coordinates?.[0] as number };
    if (!isCoordinate(coordinate)) return [];
    const properties = feature.properties ?? {};
    const get = (key: string) => typeof properties[key] === 'string' ? (properties[key] as string).trim() : undefined;
    const countryCode = get('countrycode')?.toUpperCase();
    if (countryCode && countryCode !== 'PH') return [];
    const rawCity = get('city') ?? (get('type') === 'city' ? get('name') : undefined);
    const davaoCity = rawCity === 'Davao' || rawCity === 'Davao City';
    const province = davaoCity ? 'Davao City' : normalizedProvince(get('county'), get('state'));
    // Names such as Carmen and San Isidro also exist in other provinces.
    const city = province === 'Davao del Norte' ? listingLocality(rawCity) ?? rawCity : davaoCity ? 'Davao City' : rawCity;
    const street = [get('housenumber'), get('street')].filter(Boolean).join(' ') || undefined;
    const barangay = get('district') ?? get('locality');
    const label = [...new Set([get('name'), street, barangay, city, province, get('country')].filter(Boolean))].join(', ');
    const address: LocationAddress = { label: label || 'Selected location', street, barangay, city, province, postalCode: get('postcode'), countryCode };
    return [{ id: `${properties.osm_type ?? 'point'}-${properties.osm_id ?? `${coordinate.latitude},${coordinate.longitude}`}`, coordinate, address }];
  });
}

export function createPhotonGeocoder(baseUrl = 'https://photon.komoot.io', fetcher: typeof fetch = fetch): Geocoder {
  const base = baseUrl.replace(/\/$/, '');
  async function request(path: string, params: Record<string, string>, signal?: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', abort);
    const timeout = setTimeout(abort, 12000);
    try {
      const response = await fetcher(`${base}/${path}?${new URLSearchParams({ lang: 'en', limit: '5', ...params })}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Address search is unavailable. You can still move the pin or use your current location.');
      return parsePhotonResults(await response.json()).filter((result) => isInsideDavaoDelNorte(result.coordinate) && (!result.address.province || result.address.province === 'Davao del Norte'));
    } catch (error) {
      if (signal?.aborted) throw error;
      if (controller.signal.aborted) throw new Error('Address search timed out. Please try again or move the pin manually.');
      if (error instanceof TypeError) throw new Error('Address search could not connect. Check your connection, or move the pin manually.');
      throw error;
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
  }
  return {
    search: (query, bias, signal) => request('api/', {
      q: query, countrycode: 'PH', limit: '8', bbox: [DAVAO_DEL_NORTE_BOUNDS.west, DAVAO_DEL_NORTE_BOUNDS.south, DAVAO_DEL_NORTE_BOUNDS.east, DAVAO_DEL_NORTE_BOUNDS.north].join(','), ...(bias ? { lat: String(bias.latitude), lon: String(bias.longitude), zoom: '15', location_bias_scale: '0.2' } : {}),
    }, signal),
    reverse: async (point, signal) => (await request('reverse', { lat: String(point.latitude), lon: String(point.longitude), radius: '0.1', limit: '1' }, signal))[0]?.address ?? null,
  };
}
