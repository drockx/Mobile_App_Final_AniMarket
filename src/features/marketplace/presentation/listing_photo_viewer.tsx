import { NavigationIcon } from '@/components/navigation_icon';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ListingPhotoViewer({ source, label, onClose }: { source: string; label: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return <Modal visible animationType="fade" presentationStyle="fullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <View accessibilityViewIsModal style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text numberOfLines={2} style={styles.title}>{label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close livestock photo" onPress={onClose} hitSlop={8} style={styles.close}>
          <NavigationIcon name="close" color="#fff" />
        </Pressable>
      </View>
      <View style={styles.imageArea}>
        {failed ? <View style={styles.feedback}><Text accessibilityRole="alert" style={styles.error}>Unable to load this photo. Close it and try again.</Text></View> : <Image
          source={source}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel={`Full image of ${label}`}
          style={StyleSheet.absoluteFill}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setFailed(true); }}
        />}
        {loading && <View pointerEvents="none" style={styles.feedback}><ActivityIndicator color="#fff" accessibilityLabel="Loading livestock photo" /></View>}
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  title: { flex: 1, color: '#fff', fontSize: 16, lineHeight: 22, fontWeight: '600' },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#26382f', alignItems: 'center', justifyContent: 'center' },
  imageArea: { flex: 1 },
  feedback: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#fff', fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
