import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { LocationFailure, type DeviceLocation } from '../domain/location_provider';

export const deviceLocation: DeviceLocation = {
  async current() {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) throw new LocationFailure('This browser does not support current location. Search your address or move the pin.');
      // Works in browsers without the Permissions API, including Safari. Never reuse an old GPS fix.
      return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
        (position) => resolve({ coordinate: { latitude: position.coords.latitude, longitude: position.coords.longitude }, accuracyMeters: position.coords.accuracy }),
        (error) => reject(new LocationFailure(error.code === 1 ? 'Location access was denied. Allow location in your browser settings, or search your address.' : error.code === 3 ? 'Getting your location timed out. Try again outdoors or search your address.' : 'Your current location is unavailable. Search your address or move the pin.')),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      ));
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new LocationFailure('Location access was denied. You can search your address or move the pin.', !permission.canAskAgain);
      if (!await Location.hasServicesEnabledAsync()) throw new LocationFailure('Turn on your device location services, or search your address.');
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new LocationFailure('Getting your location timed out. Try again outdoors or search your address.')), 20000); }),
      ]);
      return { coordinate: { latitude: position.coords.latitude, longitude: position.coords.longitude }, accuracyMeters: position.coords.accuracy ?? undefined };
    } catch (failure) {
      if (failure instanceof LocationFailure) throw failure;
      throw new LocationFailure('Your current location is unavailable. Check your device location settings, or search your address.');
    } finally { clearTimeout(timer); }
  },
};
