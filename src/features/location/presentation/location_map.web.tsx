import { useEffect, useRef } from 'react';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { LocationMapProps } from './location_map';

export function LocationMap({ center, selected, height = 300, onChange, onMovingChange, onInteractionChange, onError }: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<import('maplibre-gl').Map | null>(null);
  const marker = useRef<import('maplibre-gl').Marker | null>(null);
  const latest = useRef({ center, selected, onChange, onMovingChange, onInteractionChange, onError });
  useEffect(() => { latest.current = { center, selected, onChange, onMovingChange, onInteractionChange, onError }; }, [center, selected, onChange, onMovingChange, onInteractionChange, onError]);
  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    const release = () => latest.current.onInteractionChange?.(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    import('maplibre-gl').then(({ Map, Marker, NavigationControl }) => {
      if (disposed || !container.current) return;
      const start = latest.current.center;
      const map = new Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty', center: [start.longitude, start.latitude], zoom: 16, dragRotate: false, pitchWithRotate: false });
      instance.current = map;
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      let moved = false;
      map.on('movestart', (event) => { if (event.originalEvent && latest.current.onChange) { moved = true; latest.current.onMovingChange?.(true); } });
      map.on('moveend', () => {
        if (moved && latest.current.onChange) { const point = map.getCenter(); latest.current.onChange({ latitude: point.lat, longitude: point.lng }); }
        moved = false; latest.current.onMovingChange?.(false); release();
      });
      map.on('click', (event) => {
        if (!latest.current.onChange) return;
        latest.current.onChange({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
        map.easeTo({ center: event.lngLat, duration: 250 });
      });
      map.on('error', () => latest.current.onError?.());
      if (!latest.current.onChange && latest.current.selected) {
        const pin = latest.current.selected;
        marker.current = new Marker({ color: '#12372a' }).setLngLat([pin.longitude, pin.latitude]).addTo(map);
      }
      if (typeof ResizeObserver !== 'undefined') { resize = new ResizeObserver(() => map.resize()); resize.observe(container.current); }
    }).catch(() => { if (!disposed) latest.current.onError?.(); });
    return () => { disposed = true; window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); resize?.disconnect(); marker.current?.remove(); marker.current = null; instance.current?.remove(); instance.current = null; };
  }, []);
  useEffect(() => { instance.current?.easeTo({ center: [center.longitude, center.latitude], duration: 300 }); }, [center]);
  useEffect(() => { if (selected) marker.current?.setLngLat([selected.longitude, selected.latitude]); }, [selected]);
  return <View style={{ width: '100%', height }}>
    <div ref={container} onPointerDownCapture={() => onInteractionChange?.(true)} onPointerUpCapture={() => onInteractionChange?.(false)} onPointerCancel={() => onInteractionChange?.(false)} aria-label={onChange ? 'Move or tap the map to choose your pinned location' : 'Map of the confirmed location'} style={{ width: '100%', height, touchAction: 'none' }} />
    {onChange && <View pointerEvents="none" style={StyleSheet.absoluteFill}><View style={styles.pin}><SymbolView name={{ web: 'location_on', ios: 'mappin', android: 'location_on' }} size={40} tintColor="#12372a" /></View><View style={styles.target} /></View>}
  </View>;
}
const styles = StyleSheet.create({
  pin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -20, marginTop: -40, width: 40, height: 40 },
  target: { position: 'absolute', left: '50%', top: '50%', marginLeft: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#12372a44' },
});
