import type { Coordinate, LocationAddress, LocationResult } from './location';

export interface Geocoder {
  search(query: string, bias?: Coordinate, signal?: AbortSignal): Promise<LocationResult[]>;
  reverse(point: Coordinate, signal?: AbortSignal): Promise<LocationAddress | null>;
}
export interface DeviceLocation {
  current(signal?: AbortSignal): Promise<{ coordinate: Coordinate; accuracyMeters?: number }>;
}

export class LocationFailure extends Error {
  constructor(message: string, public readonly settingsAvailable = false) { super(message); }
}
