import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { coordinateLabel, isCoordinate, type Coordinate } from '../domain/location';
import { isInsideDavaoDelNorte } from '../domain/davao_del_norte_geofence';
import { LocationMap } from './location_map';

export function LocationPreview({ coordinate, label }: { coordinate?: Coordinate; label: string }) {
  const [error, setError] = useState(false);
  if (!isCoordinate(coordinate)) return null;
  const open = () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${coordinate.latitude},${coordinate.longitude}`)}`).catch(() => setError(true));
  return <View style={styles.section}>
    <Text style={styles.title}>{label}</Text>
    {isInsideDavaoDelNorte(coordinate) ? <View style={styles.map}><LocationMap center={coordinate} selected={coordinate} height={200} onLoaded={() => setError(false)} onError={() => setError(true)} /></View> : <Text style={styles.coordinates}>This saved pin is outside Davao del Norte.</Text>}
    <Text selectable style={styles.coordinates}>{coordinateLabel(coordinate)}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label} in maps`} onPress={open} style={styles.button}><Text style={styles.buttonText}>Open in Maps</Text></Pressable>
    {error && <Text accessibilityRole="alert" style={styles.coordinates}>The map is unavailable. Use the coordinates or try Open in Maps again.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 10, marginTop: 14 },
  title: { fontSize: 14, lineHeight: 20, color: '#12372a', fontWeight: '700' },
  map: { borderWidth: 1, borderColor: '#dfe8e2', borderRadius: 12, overflow: 'hidden', backgroundColor: '#eaf5ed' },
  coordinates: { color: '#52647a', fontSize: 13, lineHeight: 18 },
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#12372a', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#12372a', fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
});
