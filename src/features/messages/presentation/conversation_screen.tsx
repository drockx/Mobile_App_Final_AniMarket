import { AppTextInput as TextInput } from '@/components/app_text_input';
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavigationIcon } from '@/components/navigation_icon';
import { emptyThread, type MessageService, type PendingMessage } from '../application/message_service';
import type { ChatMessage } from '../domain/message_repository';

const forest = '#12372a';
const muted = '#5b6d63';
const sendIcon = { ios: 'paperplane.fill', android: 'send', web: 'send' } as const;
const callIcon = { ios: 'phone', android: 'call', web: 'call' } as const;

type DisplayMessage = ChatMessage | PendingMessage;
const MessageBubble = memo(function MessageBubble({ message, mine, read, onRetry }: { message: DisplayMessage; mine: boolean; read: boolean; onRetry: (message: PendingMessage) => void }) {
  const pending = 'delivery' in message ? message : undefined;
  return <View style={[styles.messageRow, mine && styles.mineRow]}>
    <View style={[styles.bubble, mine && styles.mineBubble]}>
      <Text selectable style={[styles.messageText, mine && styles.mineText]}>{message.text}</Text>
      <Text style={[styles.messageTime, mine && styles.mineTime]}>
        {new Date(message.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{mine ? pending ? pending.delivery === 'sending' ? ' · Sending…' : ' · Not sent' : read ? ' · Seen' : ' · Sent' : ''}
      </Text>
      {pending?.delivery === 'failed' && <View>
        <Text accessibilityLiveRegion="polite" style={styles.mineTime}>{pending.error}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Retry sending ${message.text}`} onPress={() => onRetry(pending)} style={styles.retry}><Text style={styles.retrySendText}>Tap to retry</Text></Pressable>
      </View>}
    </View>
  </View>;
});

export function ConversationScreen({ conversationId, service, focused, onBack, onCall, onViewProfile }: {
  conversationId: string; service: MessageService; focused: boolean; onBack: () => void; onCall: () => void;
  onViewProfile?: (userId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const conversation = snapshot.conversations.find((item) => item.id === conversationId);
  const thread = snapshot.threads[conversationId] ?? emptyThread;
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const list = useRef<FlatList<DisplayMessage>>(null);
  const messages = useMemo(() => [...thread.messages, ...thread.pending], [thread.messages, thread.pending]);
  const nearBottom = useRef(true);
  const scrollToLatest = useRef(true);
  const lastSeq = thread.syncedThrough;
  useEffect(() => {
    if (focused && snapshot.status === 'live' && nearBottom.current && lastSeq) void service.markRead(conversationId, lastSeq);
  }, [focused, snapshot.status, conversationId, lastSeq, conversation?.readSeq, service]);
  function send() {
    const text = draft.trim();
    if (!text || !conversation) return;
    if (text.length > 2000) { setSendError('Keep your message within 2,000 characters.'); return; }
    setSendError(''); scrollToLatest.current = true;
    const clientId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
    const attempt = service.send(conversationId, text, clientId);
    const queued = service.getSnapshot().threads[conversationId]?.pending.some((message) => message.clientId === clientId);
    if (queued) setDraft('');
    void attempt.catch((error) => {
      // Validation failures never entered the outbox, so keep their text in the composer.
      if (!queued) setSendError(error instanceof Error ? error.message : 'Unable to send your message.');
    });
  }
  const retry = useCallback((message: PendingMessage) => {
    void service.send(message.conversationId, message.text, message.clientId).catch(() => { /* Keep the original request ID for a safe retry. */ });
  }, [service]);
  const userId = service.getUserId();
  const otherReadSeq = conversation?.otherReadSeq ?? 0;
  const renderMessage = useCallback(({ item }: { item: DisplayMessage }) => {
    const mine = item.senderId === userId;
    return <MessageBubble message={item} mine={mine} read={mine && item.seq <= otherReadSeq} onRetry={retry} />;
  }, [userId, otherReadSeq, retry]);
  return <KeyboardAvoidingView style={styles.background} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <StatusBar style="dark" />
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 5 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to messages" onPress={onBack} style={styles.iconButton}><NavigationIcon name="back" /></Pressable>
        <View style={styles.avatar}><Text style={styles.avatarText}>{conversation?.initials ?? '…'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${conversation?.participant ?? 'user'} profile`} disabled={!onViewProfile || !conversation?.participantId} onPress={() => { if (conversation?.participantId) onViewProfile?.(conversation.participantId); }} style={styles.person}>
          <Text numberOfLines={1} style={styles.name}>{conversation?.participant ?? 'Conversation'}</Text>
          <Text style={styles.status}>{snapshot.status === 'live' ? 'Live messaging' : snapshot.status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Voice call ${conversation?.participant ?? 'user'}`} accessibilityState={{ disabled: !conversation }} disabled={!conversation} onPress={onCall} style={[styles.iconButton, !conversation && styles.disabled]}><SymbolView name={callIcon} size={23} tintColor={forest} /></Pressable>
      </View>
      {conversation?.listingId && <View style={styles.context}><Text numberOfLines={2} style={styles.contextText}>{conversation.listing}</Text></View>}
      {!!snapshot.error && <View accessibilityLiveRegion="polite" style={styles.notice}>
        <Text style={styles.noticeText}>{snapshot.error}</Text>
        <Pressable accessibilityRole="button" onPress={() => service.reconnect()} style={styles.retry}><Text style={styles.retryText}>Reconnect</Text></Pressable>
      </View>}
      <FlatList<DisplayMessage>
        ref={list}
        data={messages}
        extraData={otherReadSeq}
        keyExtractor={(item) => JSON.stringify([item.senderId, item.clientId])}
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
      {!!sendError && <Text accessibilityRole="alert" style={styles.sendError}>{sendError}</Text>}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput accessibilityLabel="Message" value={draft} onChangeText={setDraft} multiline maxLength={2000} placeholder="Type a message…" placeholderTextColor={muted} style={styles.input} editable={!!conversation} />
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" accessibilityState={{ disabled: !draft.trim() || !conversation }} disabled={!draft.trim() || !conversation} onPress={send} style={[styles.send, (!draft.trim() || !conversation) && styles.disabled]}>
          <SymbolView name={sendIcon} size={22} tintColor="#fff" />
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
  avatarText: { color: forest, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  person: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  name: { color: forest, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  status: { color: muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  context: { paddingHorizontal: 18, paddingVertical: 12, backgroundColor: '#edf7f1' },
  contextText: { color: forest, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  notice: { backgroundColor: '#fff7e4', paddingHorizontal: 16, paddingVertical: 10 },
  noticeText: { color: '#755515', fontSize: 13, lineHeight: 19 },
  retry: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { color: forest, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  retrySendText: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '700' },
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
  messageTime: { color: muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  mineTime: { color: '#d9ede0', textAlign: 'right' },
  empty: { color: muted, fontSize: 15, lineHeight: 22, paddingVertical: 30, textAlign: 'center' },
  error: { color: '#a1322c', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  sendError: { color: '#a1322c', backgroundColor: '#fff2ee', paddingHorizontal: 16, paddingVertical: 9, fontSize: 13, lineHeight: 19 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#dfe8e2' },
  input: { flex: 1, minWidth: 0, minHeight: 48, maxHeight: 140, borderWidth: 1, borderColor: '#cfdfd5', borderRadius: 20, backgroundColor: '#f8fbf9', color: '#182b20', fontSize: 15, lineHeight: 22, paddingHorizontal: 14, paddingVertical: 12, textAlignVertical: 'top' },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: forest, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
});
