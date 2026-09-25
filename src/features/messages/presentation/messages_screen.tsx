import { useMemo, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketplaceBottomBar } from '@/components/marketplace_bottom_bar';

import type { MessageService } from '../application/message_service';
import type { Conversation, ConversationSide } from '../domain/conversation';

const forest = '#123f32';
const muted = '#7f8da2';
const border = '#dce4ed';

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
      accessibilityLabel={`Open conversation with ${conversation.participant}`}
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
        <Text numberOfLines={2} style={[styles.preview, conversation.unreadCount > 0 && styles.previewUnread]}>
          {conversation.preview}
        </Text>
      </View>
      <View style={styles.cardEnd}>
        <Text style={styles.time}>{conversation.time}</Text>
        {conversation.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{conversation.unreadCount}</Text>
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
          <Text style={styles.subtitle}>Talk with buyers and sellers</Text>
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

          <View style={styles.safetyNote}>
            <Text style={styles.safetyText}>
              <Text style={styles.safetyLead}>Keep agreements in AniMarket. </Text>
              Confirm the livestock, price, proof, and pickup or delivery details before sending an order.
            </Text>
          </View>
        </ScrollView>

        <MarketplaceBottomBar activeTab="messages" bottomInset={insets.bottom} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#f9fcf9' },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#f9fcf9' },
  header: { paddingHorizontal: 15, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#dfe8e2', backgroundColor: '#fff' },
  title: { color: forest, fontSize: 20, lineHeight: 25, fontWeight: '700' },
  subtitle: { color: muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  content: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 24 },
  segmentedControl: { height: 48, borderRadius: 14, padding: 4, flexDirection: 'row', backgroundColor: '#eaf2ed' },
  segment: { flex: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentSelected: { backgroundColor: forest, shadowColor: forest, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  segmentLabel: { color: '#4b5870', fontSize: 13, lineHeight: 17, fontWeight: '600' },
  segmentLabelSelected: { color: '#fff', fontWeight: '700' },
  segmentBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  segmentBadgeSelling: { backgroundColor: '#a33b34' },
  segmentBadgeText: { color: forest, fontSize: 10, fontWeight: '700' },
  segmentBadgeTextSelling: { color: '#fff' },
  searchField: { height: 44, marginTop: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: border, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', shadowColor: '#465c6d', shadowOpacity: 0.08, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  searchInput: { flex: 1, height: '100%', marginLeft: 9, color: '#1d2b27', fontSize: 14 },
  sectionRow: { marginTop: 22, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: forest, fontSize: 18, lineHeight: 23, fontWeight: '700' },
  sectionCount: { color: muted, fontSize: 11, lineHeight: 15 },
  card: { minHeight: 96, marginBottom: 12, padding: 12, borderWidth: 1, borderColor: '#e0e7ef', borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', shadowColor: '#556a7d', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#c7e4d1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: forest, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  cardCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { flexShrink: 1, color: '#25302d', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  sellerTag: { color: '#286a4d', backgroundColor: '#e4f4e9', borderRadius: 5, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 1, fontSize: 9, fontWeight: '700' },
  listing: { color: '#286a4d', marginTop: 4, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  preview: { color: '#7f8da2', marginTop: 3, fontSize: 11, lineHeight: 15 },
  previewUnread: { color: '#25302d', fontWeight: '600' },
  cardEnd: { width: 52, alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: 2 },
  time: { color: muted, fontSize: 9, lineHeight: 13, textAlign: 'right' },
  unreadBadge: { minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: '#a33b34', alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  chevronBadge: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#e1f2e8', alignItems: 'center', justifyContent: 'center' },
  emptyState: { color: muted, fontSize: 14, lineHeight: 20, textAlign: 'center', paddingVertical: 32 },
  safetyNote: { marginTop: 2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#edf4f0' },
  safetyText: { color: '#5e7066', fontSize: 11, lineHeight: 16 },
  safetyLead: { color: forest, fontWeight: '700' },
});
