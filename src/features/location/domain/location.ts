import { DAVAO_DEL_NORTE_LOCALITIES, type DavaoDelNorteLocality } from '../../../constants/davao_del_norte';
import { isInsideDavaoDelNorte } from './davao_del_norte_geofence';

export type Coordinate = { latitude: number; longitude: number };
export type LocationAddress = {
  label: string; street?: string; barangay?: string; city?: string; province?: string; postalCode?: string; countryCode?: string;
};
export type SelectedLocation = {
  coordinate: Coordinate; address: LocationAddress | null; source: 'map' | 'current' | 'search'; accuracyMeters?: number;
};
export type LocationResult = { id: string; coordinate: Coordinate; address: LocationAddress };
export const DEFAULT_MAP_CENTER: Coordinate = { latitude: 7.4482, longitude: 125.807 };

export function isCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== 'object') return false;
  const point = value as Coordinate;
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

export function coordinateLabel(point: Coordinate) {
  return `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
}

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
export function listingLocality(value?: string): DavaoDelNorteLocality | undefined {
  if (!value) return undefined;
  const city = normalized(value.replace(/^(city of|municipality of)\s+/i, ''));
  const aliases: Record<string, DavaoDelNorteLocality> = {
    tagum: 'Tagum City', panabo: 'Panabo City', samal: 'Island Garden City of Samal',
    samalcity: 'Island Garden City of Samal', sanisidro: 'Sawata', braulioedujali: 'Braulio E. Dujali',
  };
  return aliases[city] ?? DAVAO_DEL_NORTE_LOCALITIES.find((entry) => normalized(entry) === city);
}

export function normalizedProvince(...values: (string | undefined)[]): string | undefined {
  const provinces = ['Davao del Norte', 'Davao de Oro', 'Davao Oriental', 'Davao Occidental', 'Davao del Sur', 'Davao City'];
  for (const value of values) {
    if (!value) continue;
    if (normalized(value) === 'compostelavalley') return 'Davao de Oro';
    const match = provinces.find((province) => normalized(province) === normalized(value));
    if (match) return match;
  }
  // A broad region such as Davao Region is not a province and must not fill that field.
  return values.find((value) => value && !/region|district/i.test(value));
}

export function locationIssue(location: SelectedLocation | null, allowedProvinces?: readonly string[]) {
  if (!location || !isCoordinate(location.coordinate)) return 'Choose and confirm a point on the map.';
  if (!isInsideDavaoDelNorte(location.coordinate)) return 'Choose a location inside Davao del Norte.';
  if (location.coordinate.latitude < 4 || location.coordinate.latitude > 22 || location.coordinate.longitude < 116 || location.coordinate.longitude > 127) return 'Choose a location in the Philippines.';
  if (location.address?.countryCode && location.address.countryCode.toUpperCase() !== 'PH') return 'Choose a location in the Philippines.';
  if (location.address?.province && allowedProvinces && !allowedProvinces.includes(location.address.province)) {
    return `Choose a location in ${allowedProvinces.join(', ')}.`;
  }
  return null;
}

export function copyLocation(location: SelectedLocation): SelectedLocation {
  return { ...location, coordinate: { ...location.coordinate }, address: location.address ? { ...location.address } : null };
}

export function sameCity(first: string, second: string, province?: string) {
  const key = (value: string) => normalized(value.replace(/^(city of|municipality of)\s+/i, '').replace(/\s+city$/i, ''));
  return province === 'Davao del Norte'
    ? key(listingLocality(first) ?? first) === key(listingLocality(second) ?? second)
    : key(first) === key(second);
}
