import { useState, type ComponentProps } from 'react';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { AnimalPlaceholder } from '@/components/animal_placeholder';
import type { LivestockCategory } from '../domain/listing';

/** Keep a useful livestock visual when a saved or remote photo cannot load. */
export function ListingPhoto({ source, category, label }: {
  source: ComponentProps<typeof Image>['source']; category: LivestockCategory; label: string;
}) {
  const sourceKey = typeof source === 'object' ? JSON.stringify(source) : String(source);
  const [failedSource, setFailedSource] = useState<string>();
  if (!source || sourceKey === failedSource) return <AnimalPlaceholder category={category} />;
  return <Image source={source} contentFit="cover" cachePolicy="memory-disk" recyclingKey={sourceKey} accessibilityLabel={label} onError={() => setFailedSource(sourceKey)} style={StyleSheet.absoluteFill} />;
}
