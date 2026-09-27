import { useEffect, useRef } from 'react';
import MapView, { Marker, type Region } from 'react-native-maps';

import type { PickupPin } from '../domain/listing';

export type PickupLocationMapProps = {
  pin: PickupPin | null;
  center: PickupPin | null;
  onPinChange: (pin: PickupPin) => void;
};

const tagum: Region = {
  latitude: 7.4482,
  longitude: 125.807,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025,
};

export function PickupLocationMap({ pin, center, onPinChange }: PickupLocationMapProps) {
  const map = useRef<MapView>(null);

  useEffect(() => {
    if (!center) return;
    map.current?.animateToRegion({
      ...center,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 350);
  }, [center]);

  return (
    <MapView
      ref={map}
      style={{ width: '100%', height: 230 }}
      initialRegion={tagum}
      onPress={(event) => onPinChange(event.nativeEvent.coordinate)}
      accessibilityLabel="Map for selecting livestock pickup location"
    >
      {pin && (
        <Marker
          coordinate={pin}
          draggable
          pinColor="#12372a"
          title="Livestock pickup pin"
          onDragEnd={(event) => onPinChange(event.nativeEvent.coordinate)}
        />
      )}
    </MapView>
  );
}
