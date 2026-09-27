import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { PickupPin } from '../domain/listing';
import type { PickupLocationMapProps } from './pickup_location_map';

const tagum: PickupPin = { latitude: 7.4482, longitude: 125.807 };

export function PickupLocationMap({ pin, center, onPinChange }: PickupLocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<import('maplibre-gl').Map | null>(null);
  const marker = useRef<import('maplibre-gl').Marker | null>(null);
  const markerConstructor = useRef<typeof import('maplibre-gl').Marker | null>(null);
  const pinRef = useRef(pin);
  const centerRef = useRef(center);
  const onPinChangeRef = useRef(onPinChange);

  useEffect(() => { onPinChangeRef.current = onPinChange; }, [onPinChange]);

  useEffect(() => {
    let disposed = false;
    import('maplibre-gl').then(({ Map, Marker }) => {
      if (disposed || !container.current) return;
      markerConstructor.current = Marker;
      const startingPoint = centerRef.current ?? tagum;
      const instance = new Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [startingPoint.longitude, startingPoint.latitude],
        zoom: centerRef.current ? 16 : 14,
      });
      map.current = instance;
      instance.on('click', (event) => {
        onPinChangeRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
      });
      const startingPin = pinRef.current;
      if (startingPin) {
        marker.current = new Marker({ color: '#12372a', draggable: true })
          .setLngLat([startingPin.longitude, startingPin.latitude]).addTo(instance);
        marker.current.on('dragend', () => {
          const next = marker.current?.getLngLat();
          if (next) onPinChangeRef.current({ latitude: next.lat, longitude: next.lng });
        });
      }
    });
    return () => {
      disposed = true;
      marker.current?.remove();
      marker.current = null;
      map.current?.remove();
      map.current = null;
      markerConstructor.current = null;
    };
  }, []);

  useEffect(() => {
    pinRef.current = pin;
    if (!map.current || !pin) return;
    if (!marker.current) {
      const Marker = markerConstructor.current;
      if (!Marker) return;
      marker.current = new Marker({ color: '#12372a', draggable: true })
        .setLngLat([pin.longitude, pin.latitude]).addTo(map.current);
      marker.current.on('dragend', () => {
        const next = marker.current?.getLngLat();
        if (next) onPinChangeRef.current({ latitude: next.lat, longitude: next.lng });
      });
    } else {
      marker.current.setLngLat([pin.longitude, pin.latitude]);
    }
  }, [pin]);

  useEffect(() => {
    centerRef.current = center;
    if (center) map.current?.flyTo({ center: [center.longitude, center.latitude], zoom: 16 });
  }, [center]);

  return <div ref={container} aria-label="Map for selecting livestock pickup location" style={{ width: '100%', height: 230 }} />;
}
