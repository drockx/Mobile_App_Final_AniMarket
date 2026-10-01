import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationIcon } from '@/components/navigation_icon';
import { accountColors as c } from './account_screen_layout';
import { verificationStyles as s } from './verification_styles';

export function PrivateIdPreview({ source, label }: { source: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const imageWidth = Math.max(1, width - 24);
  const imageHeight = Math.max(1, height - insets.top - insets.bottom - 130);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Enlarge ${label}`} onPress={() => { setZoom(1); setExpanded(true); }}>
      <Image source={source} contentFit="contain" cachePolicy="none" accessibilityLabel={label} style={s.photo} />
      <Text style={[s.note, styles.hint]}>Tap photo to enlarge</Text>
    </Pressable>
    <Modal visible={expanded} animationType="fade" onRequestClose={() => setExpanded(false)}>
      <View style={[styles.modal, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text style={[s.title, styles.heading]}>Private ID photo</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close ID photo" onPress={() => setExpanded(false)} style={styles.control}><NavigationIcon name="close" /></Pressable>
        </View>
        <ScrollView style={styles.viewer} contentContainerStyle={styles.imageContent}>
          <ScrollView horizontal contentContainerStyle={styles.imageContent}>
            <Image source={source} contentFit="contain" cachePolicy="none" accessibilityLabel={label} style={{ width: imageWidth * zoom, height: imageHeight * zoom }} />
          </ScrollView>
        </ScrollView>
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" disabled={zoom === 1} onPress={() => setZoom(Math.max(1, zoom - 1))} style={[s.secondary, styles.zoom, zoom === 1 && s.disabled]}><Text style={s.secondaryText}>−</Text></Pressable>
          <Text style={s.note}>{zoom}× · Scroll to inspect</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" disabled={zoom === 3} onPress={() => setZoom(Math.min(3, zoom + 1))} style={[s.secondary, styles.zoom, zoom === 3 && s.disabled]}><Text style={s.secondaryText}>+</Text></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: c.line },
  heading: { flex: 1 },
  control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hint: { textAlign: 'center', marginTop: 7 },
  viewer: { flex: 1 },
  imageContent: { padding: 6 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 10, borderTopWidth: 1, borderTopColor: c.line },
  zoom: { minWidth: 48 },
});
