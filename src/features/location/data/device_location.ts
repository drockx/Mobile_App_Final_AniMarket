import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { isCoordinate } from '../domain/location';
import { LocationFailure, type DeviceLocation } from '../domain/location_provider';

type Position = { coords: { latitude: number; longitude: number; accuracy: number | null }; timestamp: number };
type Fix = Awaited<ReturnType<DeviceLocation['current']>>;
type StartWatch = (receive: (position: Position) => void, fail: (error: Error) => void) => (() => void) | Promise<() => void>;

// A short foreground watch lets GPS refine an initial coarse fix without leaving tracking active.
function accuratePosition(start: StartWatch, signal?: AbortSignal): Promise<Fix> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let best: Fix | undefined;
    let stop: (() => void) | undefined;
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (failure?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer); signal?.removeEventListener('abort', abort); stop?.();
      if (failure) reject(failure);
      else if (best) resolve(best);
      else reject(new LocationFailure('Getting your location timed out. Try again outdoors or search your address.'));
    };
    const abort = () => finish(new Error('Location request cancelled.'));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => finish(), 20000);
    const receive = (position: Position) => {
      if (finished || !Number.isFinite(position.timestamp) || position.timestamp < started - 5000) return;
      const coordinate = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (!isCoordinate(coordinate)) return;
      const accuracy = position.coords.accuracy;
      const accuracyMeters = typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : undefined;
      if (!best || (accuracyMeters ?? Infinity) < (best.accuracyMeters ?? Infinity)) best = { coordinate, accuracyMeters };
      if (best.accuracyMeters !== undefined && best.accuracyMeters <= 20) finish();
    };
    try {
      Promise.resolve(start(receive, (error) => finish(best ? undefined : error))).then((cleanup) => {
        if (finished) cleanup(); else stop = cleanup;
      }).catch((error) => finish(error));
    } catch (error) { finish(error instanceof Error ? error : new LocationFailure('Your current location is unavailable.')); }
  });
}

export const deviceLocation: DeviceLocation = {
  async current(signal) {
    if (signal?.aborted) throw new Error('Location request cancelled.');
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) throw new LocationFailure('This browser does not support current location. Search your address or move the pin.');
      return accuratePosition((receive, fail) => {
        const watch = navigator.geolocation.watchPosition(receive, (error) => fail(new LocationFailure(
          error.code === 1 ? 'Location access was denied. Allow location in your browser settings, or search your address.'
            : error.code === 3 ? 'Getting your location timed out. Try again outdoors or search your address.'
              : 'Your current location is unavailable. Search your address or move the pin.',
        )), { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
        return () => navigator.geolocation.clearWatch(watch);
      }, signal);
    }
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (signal?.aborted) throw new Error('Location request cancelled.');
      if (!permission.granted) throw new LocationFailure('Location access was denied. You can search your address or move the pin.', !permission.canAskAgain);
      if (!await Location.hasServicesEnabledAsync()) throw new LocationFailure('Turn on your device location services, or search your address.');
      return await accuratePosition(async (receive, fail) => {
        const subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Highest, distanceInterval: 0, timeInterval: 1000, mayShowUserSettingsDialog: true },
          receive,
          () => fail(new LocationFailure('Your current location is unavailable. Check your device location settings, or search your address.')),
        );
        return () => subscription.remove();
      }, signal);
    } catch (failure) {
      if (signal?.aborted || failure instanceof LocationFailure) throw failure;
      throw new LocationFailure('Your current location is unavailable. Check your device location settings, or search your address.');
    }
  },
};
