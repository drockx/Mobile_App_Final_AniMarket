import { createLocationService } from './application/location_service';
import { deviceLocation } from './data/device_location';
import { createPhotonGeocoder } from './data/photon_geocoder';

export const locationService = createLocationService(deviceLocation, createPhotonGeocoder(process.env.EXPO_PUBLIC_GEOCODER_URL || 'https://photon.komoot.io'));
