import { useEffect, useState, useSyncExternalStore } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationIcon } from '@/components/navigation_icon';
import { callDuration } from '../domain/voice_call';
import type { VoiceService } from '../application/voice_service';

const icons = {
  mic: { ios: 'mic', android: 'mic', web: 'mic' },
  muted: { ios: 'mic.slash', android: 'mic_off', web: 'mic_off' },
  speaker: { ios: 'speaker.wave.2', android: 'volume_up', web: 'volume_up' },
  message: { ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' },
  end: { ios: 'phone.down.fill', android: 'call_end', web: 'call_end' },
  answer: { ios: 'phone.fill', android: 'call', web: 'call' },
  check: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
} as const;

function Control({ label, icon, selected = false, disabled = false, onPress }: {
  label: string; icon: keyof typeof icons; selected?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.control, disabled && styles.disabled]}>
    <View style={[styles.controlCircle, selected && styles.controlSelected]}><SymbolView name={icons[icon]} size={24} tintColor={selected ? '#12372a' : '#fff'} /></View>
    <Text style={styles.controlText}>{label}</Text>
  </Pressable>;
}

export function VoiceCallScreen({ service, onBack, onMessage }: {
  service: VoiceService; onBack: () => void; onMessage: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state.connectedAt || state.phase === 'ended') return;
    const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer);
  }, [state.connectedAt, state.phase]);
  const ended = ['ended', 'error', 'idle'].includes(state.phase);
  const incoming = state.phase === 'incoming';
  const seconds = state.connectedAt ? Math.max(0, ((state.call?.endedAt ?? now) - state.connectedAt) / 1000) : 0;
  const status = state.phase === 'incoming' ? 'Incoming voice call' : state.phase === 'outgoing' ? 'Calling…'
    : state.phase === 'preparing' ? 'Preparing your microphone…' : state.phase === 'connecting' ? 'Connecting audio…'
      : state.phase === 'reconnecting' ? 'Reconnecting audio…' : state.phase === 'connected' ? state.muted ? 'Microphone muted' : 'Connected'
        : state.call?.status === 'missed' ? 'No answer' : state.call?.status === 'declined' ? 'Call declined'
          : state.phase === 'ended' ? 'Call ended' : state.phase === 'error' ? 'Call unavailable' : 'Start a call from Messages';
  const controlsEnabled = ['connecting', 'connected', 'reconnecting', 'outgoing'].includes(state.phase) && !state.busy;
  return <LinearGradient colors={['#296a52', '#12372a', '#081f18']} locations={[0, 0.45, 1]} style={styles.background}>
    <StatusBar style="light" />
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={ended ? 'Back to messages' : 'Minimize call'} onPress={onBack} style={styles.iconButton}><NavigationIcon name="back" color="#fff" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.title}>AniMarket Voice Call</Text><Text style={styles.subtitle}>Private voice call</Text></View>
        <View style={styles.headerSpace} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.person}>
          <View style={styles.halo}><View style={styles.avatar}><Text style={styles.initials}>{state.call?.peer.initials ?? 'AM'}</Text></View>
            {state.call?.peer.verified && <View style={styles.verified}><SymbolView name={icons.check} size={24} tintColor="#12372a" /></View>}
          </View>
          <Text style={styles.name}>{state.call?.peer.name ?? 'Voice Call'}</Text>
          {state.call && <Text style={styles.location}>{state.call.peer.verified ? 'Verified account · ' : ''}{state.call.peer.city}, Davao del Norte</Text>}
          <Text accessibilityLiveRegion="polite" style={styles.callStatus}>{status}</Text>
          {state.busy && <ActivityIndicator color="#fff" style={styles.loading} accessibilityLabel={status} />}
          {!!state.connectedAt && <Text style={styles.timer}>{callDuration(seconds)}</Text>}
          {state.call?.reason === 'connection-lost' && ended && !state.error && <Text style={styles.help}>The connection was lost. You can call again from your conversation.</Text>}
          {!!state.error && <Text accessibilityRole="alert" style={styles.error}>{state.error}</Text>}
        </View>
        <View style={styles.controls}>
          {!ended && !incoming && <View style={styles.controlRow}>
            <Control label={state.muted ? 'Unmute' : 'Mute'} icon={state.muted ? 'muted' : 'mic'} selected={state.muted} disabled={!controlsEnabled} onPress={service.toggleMute} />
            {state.supportsSpeaker && <Control label="Speaker" icon="speaker" selected={state.speaker} disabled={!controlsEnabled} onPress={service.toggleSpeaker} />}
            <Control label="Message" icon="message" disabled={!state.call} onPress={() => state.call && onMessage(state.call.conversationId)} />
          </View>}
          {incoming ? <View style={styles.incomingRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Decline call" disabled={state.busy} onPress={() => { void service.decline(); }} style={[styles.callAction, state.busy && styles.disabled]}><View style={styles.endCircle}><SymbolView name={icons.end} size={30} tintColor="#fff" /></View><Text style={styles.controlText}>Decline</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Answer call" disabled={state.busy} onPress={() => { void service.accept(); }} style={[styles.callAction, state.busy && styles.disabled]}><View style={styles.answerCircle}><SymbolView name={icons.answer} size={30} tintColor="#12372a" /></View><Text style={styles.controlText}>Answer</Text></Pressable>
          </View> : !ended ? <Pressable accessibilityRole="button" accessibilityLabel="End call" onPress={() => { void service.end(); }} style={styles.callAction}><View style={styles.endCircle}><SymbolView name={icons.end} size={30} tintColor="#fff" /></View><Text style={styles.controlText}>End Call</Text></Pressable>
            : <Pressable accessibilityRole="button" onPress={() => { service.dismiss(); if (state.call) onMessage(state.call.conversationId); else onBack(); }} style={styles.returnButton}><Text style={styles.returnText}>Back to Messages</Text></Pressable>}
          <Text style={styles.help}>{incoming ? 'Answer to start sharing your microphone.' : !ended ? 'Keep AniMarket open during your call.' : state.call ? 'Return to your conversation to see call history.' : 'Choose a conversation, then tap the call button.'}</Text>
        </View>
      </ScrollView>
      <View style={{ height: Math.max(insets.bottom, 16) }} />
    </View>
  </LinearGradient>;
}
const styles = StyleSheet.create({
  background: { flex: 1 }, screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  iconButton: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: '#ffffff33', backgroundColor: '#ffffff12', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0, alignItems: 'center' }, headerSpace: { width: 44 },
  title: { color: '#fff', fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#d3e6d9', fontSize: 12, lineHeight: 18, marginTop: 3 },
  scroll: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16, justifyContent: 'space-between', gap: 36 },
  person: { alignItems: 'center' }, halo: { width: 144, height: 144, borderRadius: 72, backgroundColor: '#ffffff14', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 112, height: 112, borderRadius: 56, borderWidth: 4, borderColor: '#e8f4eb66', backgroundColor: '#c3e3cc', alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#12372a', fontSize: 34, lineHeight: 44, fontWeight: '800' },
  verified: { position: 'absolute', right: 10, bottom: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#fff', fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center', marginTop: 24 },
  location: { color: '#d3e6d9', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  callStatus: { color: '#e8f4eb', fontSize: 16, lineHeight: 22, textAlign: 'center', marginTop: 24 },
  timer: { color: '#fff', fontSize: 22, lineHeight: 30, fontWeight: '700', marginTop: 6, fontVariant: ['tabular-nums'] },
  loading: { marginTop: 12 }, error: { width: '100%', color: '#ffe4df', backgroundColor: '#5e282580', borderRadius: 12, padding: 14, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 18 },
  controls: { gap: 24, alignItems: 'center' }, controlRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-evenly', flexWrap: 'wrap', gap: 14 },
  control: { minWidth: 68, maxWidth: '100%', alignItems: 'center', gap: 8 }, controlCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#ffffff18', borderWidth: 1, borderColor: '#ffffff33', alignItems: 'center', justifyContent: 'center' },
  controlSelected: { backgroundColor: '#fff' }, controlText: { color: '#e0eee5', fontSize: 13, lineHeight: 19, textAlign: 'center', fontWeight: '600' },
  callAction: { minWidth: 84, alignItems: 'center', gap: 8 }, endCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#d84a43', alignItems: 'center', justifyContent: 'center' },
  answerCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#dff1e3', alignItems: 'center', justifyContent: 'center' },
  incomingRow: { flexDirection: 'row', justifyContent: 'space-evenly', flexWrap: 'wrap', gap: 32, width: '100%' },
  help: { color: '#d3e6d9', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 }, disabled: { opacity: 0.45 },
  returnButton: { width: '100%', minHeight: 52, padding: 14, borderRadius: 12, backgroundColor: '#dff1e3', alignItems: 'center', justifyContent: 'center' },
  returnText: { color: '#12372a', fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
});
