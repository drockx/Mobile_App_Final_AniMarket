import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavigationIcon } from '@/components/navigation_icon';
import { emptyThread, type MessageService } from '../application/message_service';
import type { ChatMessage } from '../domain/message_repository';

const forest = '#12372a';
const muted = '#5b6d63';
const sendIcon = { ios: 'paperplane.fill', android: 'send', web: 'send' } as const;

export function ConversationScreen({ conversationId, service, focused, onBack }: {
  conversationId: string; service: MessageService; focused: boolean; onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const conversation = snapshot.conversations.find((item) => item.id === conversationId);
  const thread = snapshot.threads[conversationId] ?? emptyThread;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const pending = useRef<{ text: string; clientId: string } | null>(null);
  const list = useRef<FlatList<ChatMessage>>(null);
  const nearBottom = useRef(true);
  const scrollToLatest = useRef(true);
  const lastSeq = thread.syncedThrough;
  useEffect(() => {
    if (focused && snapshot.status === 'live' && nearBottom.current && lastSeq) void service.markRead(conversationId, lastSeq);
  }, [focused, snapshot.status, conversationId, lastSeq, conversation?.readSeq, service]);
  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    if (text.length > 2000) { setSendError('Keep your message within 2,000 characters.'); return; }
    setSending(true); setSendError('');
    if (pending.current?.text !== text) pending.current = { text, clientId: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2) };
    const attempt = pending.current;
    try {
      scrollToLatest.current = true;
      await service.send(conversationId, text, attempt.clientId);
      pending.current = null;
      setDraft((current) => current.trim() === text ? '' : current);
    } catch (error) { setSendError(error instanceof Error ? error.message : 'Message was not sent. Please try again.'); }
    finally { setSending(false); }
  }
  function renderMessage({ item }: { item: ChatMessage }) {
    const mine = item.senderId === service.getUserId();
    const read = mine && item.seq <= (conversation?.otherReadSeq ?? 0);
    return <View style={[styles.messageRow, mine && styles.mineRow]}>
      <View style={[styles.bubble, mine && styles.mineBubble]}>
        <Text selectable style={[styles.messageText, mine && styles.mineText]}>{item.text}</Text>
        <Text style={[styles.messageTime, mine && styles.mineTime]}>
          {new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{mine ? read ? ' · Read' : ' · Sent' : ''}
        </Text>
      </View>
    </View>;
  }
  return <KeyboardAvoidingView style={styles.background} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <StatusBar style="dark" />
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 5 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to messages" onPress={onBack} style={styles.iconButton}><NavigationIcon name="back" /></Pressable>
        <View style={styles.avatar}><Text style={styles.avatarText}>{conversation?.initials ?? '…'}</Text></View>
        <View style={styles.person}>
          <Text numberOfLines={1} style={styles.name}>{conversation?.participant ?? 'Conversation'}</Text>
          <Text style={styles.status}>{snapshot.status === 'live' ? 'Live messaging' : snapshot.status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</Text>
        </View>
      </View>
      {conversation?.listingId && <View style={styles.context}><Text numberOfLines={2} style={styles.contextText}>{conversation.listing}</Text></View>}
      {!!snapshot.error && <View accessibilityLiveRegion="polite" style={styles.notice}>
        <Text style={styles.noticeText}>{snapshot.error}</Text>
        <Pressable accessibilityRole="button" onPress={() => service.reconnect()} style={styles.retry}><Text style={styles.retryText}>Reconnect</Text></Pressable>
      </View>}
      <FlatList<ChatMessage>
        ref={list}
        data={thread.messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.list}
        contentContainerStyle={styles.chat}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={15}
        ListHeaderComponent={<View style={styles.history}>
          {thread.hasMore && <Pressable accessibilityRole="button" disabled={thread.loading} onPress={() => { scrollToLatest.current = false; void service.loadOlder(conversationId); }} style={styles.historyButton}><Text style={styles.retryText}>Load earlier messages</Text></Pressable>}
          {thread.loading && <ActivityIndicator color={forest} accessibilityLabel="Loading messages" />}
          {!!thread.error && <View accessibilityLiveRegion="polite"><Text style={styles.error}>{thread.error}</Text><Pressable accessibilityRole="button" onPress={() => { void service.reload(conversationId); }} style={styles.historyButton}><Text style={styles.retryText}>Try again</Text></Pressable></View>}
        </View>}
        ListEmptyComponent={!thread.loading && !thread.error ? <Text style={styles.empty}>{conversation ? 'Say hello to start the conversation.' : snapshot.status === 'live' ? 'Conversation unavailable. Go back to Messages and choose a user.' : 'Connecting to your conversation…'}</Text> : null}
        onContentSizeChange={() => { if (scrollToLatest.current || nearBottom.current) { list.current?.scrollToEnd({ animated: false }); scrollToLatest.current = false; } }}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          nearBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 90;
          if (focused && nearBottom.current && lastSeq) void service.markRead(conversationId, lastSeq);
        }}
        scrollEventThrottle={150}
      />
      {!!sendError && <Text accessibilityRole="alert" style={styles.sendError}>{sendError} Your message is kept below.</Text>}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput accessibilityLabel="Message" value={draft} onChangeText={setDraft} multiline maxLength={2000} placeholder="Type a message…" placeholderTextColor={muted} selectionColor={forest} style={styles.input} editable={!!conversation} />
        <Pressable accessibilityRole="button" accessibilityLabel={sending ? 'Sending message' : 'Send message'} accessibilityState={{ disabled: sending || !draft.trim() || !conversation }} disabled={sending || !draft.trim() || !conversation} onPress={send} style={[styles.send, (sending || !draft.trim() || !conversation) && styles.disabled]}>
          {sending ? <ActivityIndicator color="#fff" /> : <SymbolView name={sendIcon} size={22} tintColor="#fff" />}
        </Pressable>
      </View>
    </View>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#dfe8e2' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#c7e4d1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: forest, fontSize: 15, fontWeight: '700' },
  person: { flex: 1, minWidth: 0 },
  name: { color: forest, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  status: { color: muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  context: { paddingHorizontal: 18, paddingVertical: 12, backgroundColor: '#edf7f1' },
  contextText: { color: forest, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  notice: { backgroundColor: '#fff7e4', paddingHorizontal: 16, paddingVertical: 10 },
  noticeText: { color: '#755515', fontSize: 13, lineHeight: 19 },
  retry: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { color: forest, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  list: { flex: 1 },
  chat: { paddingHorizontal: 16, paddingVertical: 16 },
  history: { alignItems: 'center', marginBottom: 12, gap: 8 },
  historyButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  messageRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 12 },
  mineRow: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 17, borderBottomLeftRadius: 5, backgroundColor: '#edf4ef' },
  mineBubble: { backgroundColor: forest, borderBottomLeftRadius: 17, borderBottomRightRadius: 5 },
  messageText: { color: '#182b20', fontSize: 15, lineHeight: 22 },
  mineText: { color: '#fff' },
  messageTime: { color: muted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  mineTime: { color: '#d9ede0', textAlign: 'right' },
  empty: { color: muted, fontSize: 15, lineHeight: 22, paddingVertical: 30, textAlign: 'center' },
  error: { color: '#a1322c', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  sendError: { color: '#a1322c', backgroundColor: '#fff2ee', paddingHorizontal: 16, paddingVertical: 9, fontSize: 13, lineHeight: 19 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#dfe8e2' },
  input: { flex: 1, minWidth: 0, minHeight: 48, maxHeight: 140, borderWidth: 1, borderColor: '#cfdfd5', borderRadius: 20, backgroundColor: '#f8fbf9', color: '#182b20', fontSize: 15, lineHeight: 22, paddingHorizontal: 14, paddingVertical: 12, textAlignVertical: 'top' },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: forest, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
});
