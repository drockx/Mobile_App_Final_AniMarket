import { KeyboardScrollView } from '@/components/keyboard_scroll_view';
import { AppTextInput as TextInput } from '@/components/app_text_input';
import { NavigationIcon } from '@/components/navigation_icon';
import { useState, useSyncExternalStore } from 'react';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketplaceBottomBar } from '@/components/marketplace_bottom_bar';

import type { MessageService } from '../application/message_service';
import { filterConversations, type Conversation, type ConversationSide } from '../domain/conversation';
import { NewMessageDialog } from './new_message_dialog';

const forest = '#12372a';
const muted = '#75847b';
const border = '#dce8e1';

const icons = {
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
} as const;

type IconName = React.ComponentProps<typeof SymbolView>['name'];

function Icon({ name, size = 19, color = forest }: { name: IconName; size?: number; color?: string }) {
  return <SymbolView name={name} size={size} tintColor={color} />;
}

function ConversationCard({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${conversation.participant}${conversation.unreadCount > 0 ? `, ${conversation.unreadCount} unread messages` : ''}`}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.avatar}><Text style={styles.avatarText}>{conversation.initials}</Text></View>
      <View style={styles.cardCopy}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>{conversation.participant}</Text>
          {conversation.verifiedSeller && <Text style={styles.sellerTag}>Seller</Text>}
        </View>
        <Text numberOfLines={1} style={styles.listing}>{conversation.listing}</Text>
        <Text numberOfLines={1} style={styles.preview}>{conversation.preview}</Text>
      </View>
      <View style={styles.cardEnd}>
        <Text style={styles.time}>{conversation.time}</Text>
        {conversation.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{conversation.unreadCount} unread</Text>
          </View>
        ) : (
          <View style={styles.chevronBadge}><NavigationIcon name="next" /></View>
        )}
      </View>
    </Pressable>
  );
}

type MessagesScreenProps = {
  initialSide?: ConversationSide;
  service: MessageService;
  onOpenConversation: (conversation: Conversation) => void;
  notice?: string;
};

export function MessagesScreen({ service, onOpenConversation, initialSide = 'buying', notice }: MessagesScreenProps) {
  const insets = useSafeAreaInsets();
  const [side, setSide] = useState<ConversationSide>(initialSide);
  const [query, setQuery] = useState('');
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const conversations = filterConversations(snapshot.conversations, side, query);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.background}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 9 }]}>
          <Text style={styles.title}>Messages</Text>
          <Pressable accessibilityRole="button" onPress={() => setNewMessageOpen(true)} style={styles.newButton}><Text style={styles.newButtonText}>New message</Text></Pressable>
        </View>

        <KeyboardScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!!notice && <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
          <View style={styles.connectionRow}>
            <Text style={styles.connectionText}>{snapshot.status === 'live' ? 'Live messaging' : snapshot.status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</Text>
            {snapshot.status === 'offline' && <Pressable accessibilityRole="button" onPress={() => service.reconnect()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>}
          </View>
          {!!snapshot.error && <Text accessibilityLiveRegion="polite" style={styles.notice}>{snapshot.error}</Text>}
          <View style={styles.segmentedControl}>
            {(['buying', 'selling'] as const).map((option) => {
              const selected = side === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setSide(option)}
                  style={[styles.segment, selected && styles.segmentSelected]}
                >
                  <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
                    {option === 'buying' ? 'Buying' : 'Selling'}
                  </Text>
                  <View style={[styles.segmentBadge, option === 'selling' && styles.segmentBadgeSelling]}>
                    <Text style={[styles.segmentBadgeText, option === 'selling' && styles.segmentBadgeTextSelling]}>
                      {service.badgeCount(option)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.searchField}>
            <Icon name={icons.search} size={18} color="#667b72" />
            <TextInput
              accessibilityLabel="Search conversations"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search person, listing, or order"
              placeholderTextColor="#506159"
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{side === 'buying' ? 'Buying inquiries' : 'Selling inquiries'}</Text>
            <Text style={styles.sectionCount}>
              {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
            </Text>
          </View>

          {conversations.length > 0 ? conversations.map((conversation) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              onPress={() => onOpenConversation(conversation)}
            />
          )) : (
            <Text style={styles.emptyState}>{query ? 'No conversations match your search.' : 'No conversations yet. Tap New message to contact another user.'}</Text>
          )}

        </KeyboardScrollView>

        <MarketplaceBottomBar activeTab="messages" bottomInset={insets.bottom} />
        {newMessageOpen && <NewMessageDialog service={service} visible onClose={() => setNewMessageOpen(false)} onOpen={onOpenConversation} />}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { paddingHorizontal: 15, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e7eeea', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: forest, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  newButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: forest, alignItems: 'center', justifyContent: 'center' },
  newButtonText: { color: '#fff', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  connectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  connectionText: { color: '#52675a', fontSize: 12, lineHeight: 18 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  retryText: { color: forest, fontSize: 14, fontWeight: '700' },
  notice: { color: '#795715', backgroundColor: '#fff7e4', padding: 12, borderRadius: 12, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  content: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 24 },
  segmentedControl: { minHeight: 46, borderRadius: 13, padding: 4, flexDirection: 'row', backgroundColor: '#eef7f3' },
  segment: { flex: 1, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentSelected: { backgroundColor: forest },
  segmentLabel: { color: '#40564a', fontSize: 14, lineHeight: 19, fontWeight: '700' },
  segmentLabelSelected: { color: '#fff', fontWeight: '700' },
  segmentBadge: { minWidth: 20, minHeight: 20, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  segmentBadgeSelling: { backgroundColor: '#aa3028' },
  segmentBadgeText: { color: forest, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  segmentBadgeTextSelling: { color: '#fff' },
  searchField: { minHeight: 46, marginTop: 13, paddingHorizontal: 12, borderWidth: 1, borderColor: border, borderRadius: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  searchInput: { flex: 1, minHeight: 44, marginLeft: 9, color: '#1d2b27', fontSize: 14 },
  sectionRow: { marginTop: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: forest, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  sectionCount: { color: '#586b60', fontSize: 12, lineHeight: 16 },
  card: { minHeight: 84, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: border, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  avatar: { width: 46, height: 46, borderRadius: 13, backgroundColor: '#c7e4d1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: forest, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  cardCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { flexShrink: 1, color: '#17221d', fontSize: 14, lineHeight: 19, fontWeight: '700' },
  sellerTag: { color: '#22583e', backgroundColor: '#e4f4e9', borderRadius: 5, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 2, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  listing: { color: '#2d6a4f', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 3 },
  preview: { color: muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  cardEnd: { minWidth: 56, alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'space-between' },
  time: { color: '#586b60', fontSize: 11, lineHeight: 16 },
  unreadBadge: { minHeight: 24, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, backgroundColor: '#e8f5ed', alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: forest, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  chevronBadge: { width: 27, height: 27, borderRadius: 9, backgroundColor: '#e8f5ed', alignItems: 'center', justifyContent: 'center' },
  emptyState: { color: muted, fontSize: 14, lineHeight: 20, textAlign: 'center', paddingVertical: 32 },
});
