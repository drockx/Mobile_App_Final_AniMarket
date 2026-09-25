import { useMemo, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MessageService } from '../application/message_service';
import type { Conversation, ConversationSide } from '../domain/conversation';

const forest = '#12372a';
const muted = '#728079';
const border = '#dfe8e2';

const icons = {
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  home: { ios: 'house', android: 'home', web: 'home' },
  messages: { ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  chart: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  profile: { ios: 'person.crop.circle', android: 'person_outline', web: 'person_outline' },
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
        <Text numberOfLines={1} style={[styles.preview, conversation.unreadCount > 0 && styles.previewUnread]}>
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

function BottomNavigation({ onHome, bottomInset }: { onHome: () => void; bottomInset: number }) {
  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Home" onPress={onHome} style={styles.navItem}>
        <Icon name={icons.home} size={20} color="#8899aa" />
        <Text style={styles.navLabel}>Home</Text>
      </Pressable>
      <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={styles.navItem}>
        <Icon name={icons.messages} size={20} color={forest} />
        <Text style={styles.navLabelActive}>Messages</Text>
      </View>
      <View style={styles.addSlot}>
        <Pressable accessibilityRole="button" accessibilityLabel="Create listing unavailable" disabled style={styles.addButton}>
          <Icon name={icons.add} size={20} color="#fff" />
        </Pressable>
      </View>
      <View style={styles.navItem}>
        <Icon name={icons.chart} size={20} color="#8899aa" />
        <Text style={styles.navLabel}>Market Reference</Text>
      </View>
      <View style={styles.navItem}>
        <Icon name={icons.profile} size={20} color="#8899aa" />
        <Text style={styles.navLabel}>Profile</Text>
      </View>
    </View>
  );
}

type MessagesScreenProps = {
  service: MessageService;
  onHome: () => void;
  onOpenConversation: (conversation: Conversation) => void;
};

export function MessagesScreen({ service, onHome, onOpenConversation }: MessagesScreenProps) {
  const insets = useSafeAreaInsets();
  const [side, setSide] = useState<ConversationSide>('buying');
  const [query, setQuery] = useState('');
  const conversations = useMemo(() => service.list(side, query), [service, side, query]);

  return (
    <View style={styles.background}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
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

        <BottomNavigation onHome={onHome} bottomInset={insets.bottom} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#edf3ef' },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e7ede9' },
  title: { color: forest, fontSize: 21, lineHeight: 25, fontWeight: '800' },
  subtitle: { color: muted, fontSize: 10, lineHeight: 14, marginTop: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
  segmentedControl: { height: 45, borderRadius: 13, padding: 4, flexDirection: 'row', backgroundColor: '#edf4f0' },
  segment: { flex: 1, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segmentSelected: { backgroundColor: forest, shadowColor: forest, shadowOpacity: 0.18, shadowRadius: 5, elevation: 2 },
  segmentLabel: { color: '#53635b', fontSize: 12, fontWeight: '700' },
  segmentLabelSelected: { color: '#fff' },
  segmentBadge: { minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  segmentBadgeSelling: { backgroundColor: '#a33b34' },
  segmentBadgeText: { color: forest, fontSize: 9, fontWeight: '800' },
  segmentBadgeTextSelling: { color: '#fff' },
  searchField: { height: 43, marginTop: 13, paddingHorizontal: 13, borderWidth: 1, borderColor: border, borderRadius: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  searchInput: { flex: 1, height: '100%', marginLeft: 9, color: '#24332b', fontSize: 12 },
  sectionRow: { marginTop: 15, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: forest, fontSize: 12, fontWeight: '800' },
  sectionCount: { color: muted, fontSize: 10 },
  card: { minHeight: 78, marginBottom: 9, padding: 10, borderWidth: 1, borderColor: border, borderRadius: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  avatar: { width: 46, height: 46, borderRadius: 13, backgroundColor: '#c7e4d1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: forest, fontSize: 11, fontWeight: '800' },
  cardCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { flexShrink: 1, color: '#17221d', fontSize: 12, fontWeight: '800' },
  sellerTag: { color: '#3c7d5a', backgroundColor: '#e4f4e9', borderRadius: 4, overflow: 'hidden', paddingHorizontal: 4, fontSize: 8, fontWeight: '700' },
  listing: { color: '#286a4d', marginTop: 4, fontSize: 9, fontWeight: '700' },
  preview: { color: '#6f7e74', marginTop: 3, fontSize: 10 },
  previewUnread: { color: '#22332a', fontWeight: '700' },
  cardEnd: { width: 48, alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: 2 },
  time: { color: muted, fontSize: 8 },
  unreadBadge: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#a33b34', alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  chevronBadge: { width: 25, height: 25, borderRadius: 8, backgroundColor: '#e1f2e8', alignItems: 'center', justifyContent: 'center' },
  emptyState: { color: muted, fontSize: 12, textAlign: 'center', paddingVertical: 28 },
  safetyNote: { marginTop: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 10, backgroundColor: '#f4f8f6' },
  safetyText: { color: '#637069', fontSize: 10, lineHeight: 15 },
  safetyLead: { color: forest, fontWeight: '800' },
  bottomBar: { minHeight: 62, borderTopWidth: 1, borderTopColor: '#dfe8e2', paddingTop: 6, flexDirection: 'row', backgroundColor: '#fff' },
  navItem: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navLabel: { color: '#8496aa', fontSize: 9, textAlign: 'center' },
  navLabelActive: { color: forest, fontSize: 9, fontWeight: '800' },
  addSlot: { flex: 1, minHeight: 50, alignItems: 'center' },
  addButton: { width: 34, height: 34, marginTop: -1, borderWidth: 3, borderColor: '#fff', borderRadius: 17, backgroundColor: forest, alignItems: 'center', justifyContent: 'center', shadowColor: forest, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
});
