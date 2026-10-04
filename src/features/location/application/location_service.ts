import { isCoordinate, type Coordinate } from '../domain/location';
import { isInsideDavaoDelNorte } from '../domain/davao_del_norte_geofence';
import type { DeviceLocation, Geocoder } from '../domain/location_provider';

export function createLocationService(device: DeviceLocation, geocoder: Geocoder) {
  const addressCache = new Map<string, Awaited<ReturnType<Geocoder['reverse']>>>();
  return {
    async current(signal?: AbortSignal) {
      const result = await device.current(signal);
      if (!isCoordinate(result.coordinate)) throw new Error('The device returned an invalid location. Search your address or move the pin.');
      if (!isInsideDavaoDelNorte(result.coordinate)) throw new Error('Your current location is outside Davao del Norte. Search for an address in Davao del Norte or choose one on the map.');
      return result;
    },
    async search(query: string, bias?: Coordinate, signal?: AbortSignal) {
      const text = query.trim();
      return text.length < 3 ? [] : (await geocoder.search(text, bias, signal)).filter((result) => isInsideDavaoDelNorte(result.coordinate) && (!result.address.province || result.address.province === 'Davao del Norte'));
    },
    async reverse(point: Coordinate, signal?: AbortSignal) {
      if (!isCoordinate(point)) throw new Error('Choose a valid point on the map.');
      if (!isInsideDavaoDelNorte(point)) throw new Error('Choose a location inside Davao del Norte.');
      const key = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
      if (addressCache.has(key)) return { ...addressCache.get(key)! };
      const address = await geocoder.reverse(point, signal);
      if (!signal?.aborted && address) {
        if (addressCache.size >= 100) addressCache.delete(addressCache.keys().next().value!);
        addressCache.set(key, { ...address });
      }
      return address;
    },
  };
}

export type LocationService = ReturnType<typeof createLocationService>;
