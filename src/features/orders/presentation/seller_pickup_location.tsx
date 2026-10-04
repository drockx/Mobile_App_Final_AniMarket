import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { isCoordinate, type Coordinate } from '@/features/location/domain/location';
import { LocationPreview } from '@/features/location/presentation/location_preview';

type LoadPickupPin = (id: string) => Promise<Coordinate | undefined>;

export function SellerPickupLocation({ listingId, loadPickupPin }: { listingId: string; loadPickupPin: LoadPickupPin }) {
  const [result, setResult] = useState<{ listingId: string; attempt: number; loader: LoadPickupPin; pin?: Coordinate; error: boolean }>();
  const [attempt, setAttempt] = useState(0);
  const loading = !result || result.listingId !== listingId || result.attempt !== attempt || result.loader !== loadPickupPin;

  useEffect(() => {
    let active = true;
    loadPickupPin(listingId).then((coordinate) => {
      if (active) setResult({ listingId, attempt, loader: loadPickupPin, pin: isCoordinate(coordinate) ? { ...coordinate } : undefined, error: false });
    }).catch(() => { if (active) setResult({ listingId, attempt, loader: loadPickupPin, error: true }); });
    return () => { active = false; };
  }, [listingId, loadPickupPin, attempt]);

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#12372a" /><Text style={styles.copy}>Loading seller pickup pin…</Text></View>;
  if (result.error) return <View style={styles.section}>
    <Text accessibilityRole="alert" style={styles.copy}>The seller’s pickup pin could not load. Check your connection and retry.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Retry seller pickup map" onPress={() => setAttempt((value) => value + 1)} style={styles.button}><Text style={styles.buttonText}>Retry Map</Text></Pressable>
  </View>;
  if (!result.pin) return <Text style={styles.copy}>The seller has not provided an exact pickup pin. Confirm the meeting point with the seller.</Text>;
  return <LocationPreview label="Seller pickup pin" coordinate={result.pin} />;
}

const styles = StyleSheet.create({
  section: { gap: 10, marginTop: 10 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  copy: { flexShrink: 1, color: '#52647a', fontSize: 13, lineHeight: 18, marginTop: 6 },
  button: { minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#12372a', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#12372a', fontSize: 14, lineHeight: 20, fontWeight: '700' },
});
