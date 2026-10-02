import { AppTextInput as TextInput } from '@/components/app_text_input';
import { KeyboardScrollView } from '@/components/keyboard_scroll_view';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavigationIcon } from '@/components/navigation_icon';
import type { MessageService } from '../application/message_service';
import type { Conversation } from '../domain/conversation';
import type { ChatUser } from '../domain/message_repository';

export function NewMessageDialog({ service, visible, onClose, onOpen }: { service: MessageService; visible: boolean; onClose: () => void; onOpen: (conversation: Conversation) => void }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      void service.searchUsers(query.trim(), controller.signal).then((results) => {
        if (!controller.signal.aborted) setUsers(results);
      }).catch((issue) => {
        if (!controller.signal.aborted) setError(issue instanceof Error ? issue.message : 'Unable to find users.');
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, visible, service]);
  async function open(user: ChatUser) {
    if (opening) return;
    setOpening(user.id); setError('');
    try { const conversation = await service.openConversation(user.id); onClose(); onOpen(conversation); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Unable to open this conversation.'); }
    finally { setOpening(''); }
  }
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>New message</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close new message" onPress={onClose} style={styles.close}><NavigationIcon name="close" /></Pressable>
      </View>
      <KeyboardScrollView>
      <Text style={styles.hint}>Find a user by name or enter their full email address.</Text>
      <TextInput accessibilityLabel="Find another user" value={query} onChangeText={(value) => { setQuery(value); setUsers([]); setLoading(value.trim().length >= 2); setError(''); }} autoCapitalize="none" autoCorrect={false} maxLength={120} placeholder="Search users…" placeholderTextColor="#5b6d63" style={styles.input} />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading && <ActivityIndicator color="#12372a" style={styles.loader} accessibilityLabel="Finding users" />}
      <View style={styles.results}>
        {users.map((user) => <Pressable key={user.id} accessibilityRole="button" accessibilityLabel={`Message ${user.fullName}, ${user.city}`} disabled={!!opening} onPress={() => { void open(user); }} style={styles.user}>
          <View style={styles.avatar}><Text style={styles.initials}>{user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</Text></View>
          <View style={styles.copy}><Text style={styles.name}>{user.fullName}</Text><Text style={styles.city}>{user.city}</Text></View>
          {opening === user.id ? <ActivityIndicator color="#12372a" /> : <NavigationIcon name="next" />}
        </Pressable>)}
        {!loading && !error && !users.length && <Text style={styles.hint}>{query.trim().length < 2 ? 'Type at least 2 characters. Both users need AniMarket accounts.' : 'No registered users found. Try a name or full email address.'}</Text>}
      </View>
      </KeyboardScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 18, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  title: { flex: 1, color: '#12372a', fontSize: 22, lineHeight: 29, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hint: { color: '#5b6d63', fontSize: 14, lineHeight: 21, marginBottom: 16 },
  input: { minHeight: 50, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: '#cfdfd5', backgroundColor: '#f8fbf9', color: '#182b20', fontSize: 15 },
  loader: { padding: 16 },
  error: { color: '#a1322c', fontSize: 14, lineHeight: 20, paddingVertical: 12 },
  results: { paddingTop: 16 },
  user: { minHeight: 76, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: '#dce8e1' },
  avatar: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#c7e4d1', alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#12372a', fontWeight: '700', fontSize: 14 },
  copy: { flex: 1, minWidth: 0 },
  name: { color: '#182b20', fontSize: 15, lineHeight: 21, fontWeight: '700' },
  city: { color: '#5b6d63', fontSize: 13, lineHeight: 19, marginTop: 3 },
});
