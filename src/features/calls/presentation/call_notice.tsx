import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { VoiceService } from '../application/voice_service';

export function CallNotice({ service, hidden, onOpen }: { service: VoiceService; hidden: boolean; onOpen: () => void }) {
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const insets = useSafeAreaInsets(); const incoming = state.phase === 'incoming';
  useEffect(() => {
    if (!incoming) return;
    Vibration.vibrate([0, 600, 500, 600], true); return () => Vibration.cancel();
  }, [incoming]);
  if (hidden || !state.call || !['incoming', 'outgoing', 'connecting', 'connected', 'reconnecting'].includes(state.phase)) return null;
  return <View style={[styles.container, { top: insets.top + 8 }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={incoming ? `Incoming call from ${state.call.peer.name}. Open to answer.` : 'Return to your voice call'} onPress={onOpen} style={styles.open}>
      <Text numberOfLines={1} style={styles.name}>{state.call.peer.name}</Text><Text style={styles.status}>{incoming ? 'Incoming voice call · Tap to answer' : 'Voice call · Tap to return'}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={incoming ? 'Decline call' : 'End call'} onPress={() => { void (incoming ? service.decline() : service.end()); }} style={styles.end}><Text style={styles.endText}>{incoming ? 'Decline' : 'End'}</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  container: { position: 'absolute', left: 12, right: 12, alignSelf: 'center', maxWidth: 456, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14, backgroundColor: '#12372a', elevation: 8, shadowColor: '#081f18', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  open: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center' }, name: { color: '#fff', fontSize: 15, lineHeight: 21, fontWeight: '700' },
  status: { color: '#dff1e3', fontSize: 12, lineHeight: 18 }, end: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#a52f2a', alignItems: 'center', justifyContent: 'center' }, endText: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '700' },
});
