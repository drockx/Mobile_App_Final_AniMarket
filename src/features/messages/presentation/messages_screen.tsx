import { useMemo, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketplaceBottomBar } from '@/components/marketplace_bottom_bar';

import type { MessageService } from '../application/message_service';
import type { Conversation, ConversationSide } from '../domain/conversation';

const forest = '#12372a';
const muted = '#75847b';
const border = '#dce8e1';

const icons = {
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
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
        <Text style={styles.time}>{conversation.time}</Text>
      </View>
      <View style={styles.cardEnd}>
        {conversation.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{conversation.unreadCount} unread</Text>
          </View>
        ) : (
          <View style={styles.chevronBadge}><Icon name={icons.chevron} size={14} color={forest} /></View>
        )}
      </View>
    </Pressable>
  );
}

type MessagesScreenProps = {
  service: MessageService;
  onOpenConversation: (conversation: Conversation) => void;
};

export function MessagesScreen({ service, onOpenConversation }: MessagesScreenProps) {
  const insets = useSafeAreaInsets();
  const [side, setSide] = useState<ConversationSide>('buying');
  const [query, setQuery] = useState('');
  const conversations = useMemo(() => service.list(side, query), [service, side, query]);

  return (
    <View style={styles.background}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 9 }]}>
          <Text style={styles.title}>Messages</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
            <Text style={styles.emptyState}>No conversations match your search.</Text>
          )}

        </ScrollView>

        <MarketplaceBottomBar activeTab="messages" bottomInset={insets.bottom} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { paddingHorizontal: 15, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#e7eeea', backgroundColor: '#fff' },
  title: { color: forest, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  content: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 24 },
  segmentedControl: { height: 46, borderRadius: 13, padding: 4, flexDirection: 'row', backgroundColor: '#eef7f3' },
  segment: { flex: 1, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentSelected: { backgroundColor: forest },
  segmentLabel: { color: '#526259', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  segmentLabelSelected: { color: '#fff', fontWeight: '700' },
  segmentBadge: { minWidth: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  segmentBadgeSelling: { backgroundColor: '#aa3028' },
  segmentBadgeText: { color: forest, fontSize: 9, fontWeight: '700' },
  segmentBadgeTextSelling: { color: '#fff' },
  searchField: { height: 42, marginTop: 13, paddingHorizontal: 12, borderWidth: 1, borderColor: border, borderRadius: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  searchInput: { flex: 1, height: '100%', marginLeft: 9, color: '#1d2b27', fontSize: 12 },
  sectionRow: { marginTop: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: forest, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  sectionCount: { color: muted, fontSize: 9, lineHeight: 13 },
  card: { minHeight: 76, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: border, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  avatar: { width: 46, height: 46, borderRadius: 13, backgroundColor: '#c7e4d1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: forest, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  cardCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { flexShrink: 1, color: '#17221d', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  sellerTag: { color: '#286a4d', backgroundColor: '#e4f4e9', borderRadius: 5, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 1, fontSize: 8, fontWeight: '700' },
  cardEnd: { minWidth: 28, alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'center' },
  time: { color: muted, marginTop: 3, fontSize: 9, lineHeight: 13 },
  unreadBadge: { minHeight: 22, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#e8f5ed', alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: forest, fontSize: 9, fontWeight: '700' },
  chevronBadge: { width: 27, height: 27, borderRadius: 9, backgroundColor: '#e8f5ed', alignItems: 'center', justifyContent: 'center' },
  emptyState: { color: muted, fontSize: 14, lineHeight: 20, textAlign: 'center', paddingVertical: 32 },
});
