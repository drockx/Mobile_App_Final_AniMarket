import { useEffect, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import type { Coordinate } from '../domain/location';

export type LocationMapProps = {
  center: Coordinate; selected: Coordinate | null; height?: number;
  onChange?: (coordinate: Coordinate) => void; onMovingChange?: (moving: boolean) => void; onError?: () => void;
  onInteractionChange?: (interacting: boolean) => void;
};

export function LocationMap({ center, selected, height = 300, onChange, onMovingChange, onInteractionChange, onError }: LocationMapProps) {
  const map = useRef<MapView>(null);
  const ready = useRef(false);
  const moved = useRef(false);
  const touched = useRef(false);
  const latestError = useRef(onError);
  useEffect(() => { latestError.current = onError; }, [onError]);
  useEffect(() => {
    const timeout = setTimeout(() => { if (!ready.current) latestError.current?.(); }, 20000);
    return () => clearTimeout(timeout);
  }, []);
  const [initialRegion] = useState(() => ({ ...center, latitudeDelta: 0.012, longitudeDelta: 0.012 }));
  useEffect(() => {
    if (ready.current) map.current?.animateToRegion({ ...center, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 300);
  }, [center]);

  return <View style={{ width: '100%', height }} onTouchStart={() => { touched.current = true; onInteractionChange?.(true); }} onTouchEnd={() => { touched.current = false; onInteractionChange?.(false); }} onTouchCancel={() => { touched.current = false; onInteractionChange?.(false); }}>
    <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={initialRegion}
      accessibilityLabel={onChange ? 'Move or tap the map to choose your pinned location' : 'Map of the confirmed location'}
      rotateEnabled={false} pitchEnabled={false} showsMyLocationButton={false} showsCompass={false}
      onMapReady={() => { ready.current = true; map.current?.animateToRegion({ ...center, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 0); }}
      onPanDrag={() => { if (onChange) { moved.current = true; onMovingChange?.(true); } }}
      onRegionChangeStart={(_, details) => {
        if (onChange && (details?.isGesture || (details?.isGesture === undefined && touched.current))) { moved.current = true; onMovingChange?.(true); }
      }}
      onRegionChangeComplete={(region, details) => {
        if (onChange && (moved.current || details?.isGesture)) onChange({ latitude: region.latitude, longitude: region.longitude });
        moved.current = false; onMovingChange?.(false);
      }}
      onPress={onChange ? (event) => {
        const point = event.nativeEvent.coordinate;
        onChange(point); map.current?.animateToRegion({ ...point, latitudeDelta: 0.009, longitudeDelta: 0.009 }, 250);
      } : undefined}
    >
      {!onChange && selected && <Marker coordinate={selected} pinColor="#12372a" title="Confirmed location" />}
    </MapView>
    {onChange && <View pointerEvents="none" style={StyleSheet.absoluteFill}><View style={styles.pin}><SymbolView name={{ ios: 'mappin', android: 'location_on', web: 'location_on' }} size={40} tintColor="#12372a" /></View><View style={styles.target} /></View>}
  </View>;
}

const styles = StyleSheet.create({
  pin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -20, marginTop: -40, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  target: { position: 'absolute', left: '50%', top: '50%', marginLeft: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#12372a44' },
});
