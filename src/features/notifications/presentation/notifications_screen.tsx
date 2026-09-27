import { useState, useSyncExternalStore } from 'react';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { notificationStore, type AppNotification, type NotificationCategory } from '../notification_store';

const colors = {
  forest: '#12372a',
  green: '#2d6a4f',
  mint: '#eaf5ed',
  soft: '#f7fcf8',
  line: '#dfe8e2',
  ink: '#17221d',
  muted: '#6b776f',
  blue: '#245e8a',
  blueSoft: '#edf5fb',
  amber: '#966300',
  amberSoft: '#fff7df',
  red: '#b42318',
  redSoft: '#fff0ee',
};

const filters: { label: string; value: NotificationCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Orders', value: 'order' },
  { label: 'Messages', value: 'message' },
  { label: 'Listings', value: 'listing' },
  { label: 'System', value: 'system' },
];

const icons = {
  back: { ios: 'chevron.left', android: 'arrow_back_ios_new', web: 'arrow_back_ios_new' },
  message: { ios: 'message', android: 'chat_bubble_outline', web: 'chat_bubble_outline' },
  order: { ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' },
  listing: { ios: 'list.bullet.rectangle', android: 'receipt_long', web: 'receipt_long' },
  delivery: { ios: 'truck.box', android: 'local_shipping', web: 'local_shipping' },
  bell: { ios: 'bell', android: 'notifications_none', web: 'notifications_none' },
  complete: { ios: 'checkmark.circle', android: 'check_circle_outline', web: 'check_circle_outline' },
  rating: { ios: 'star', android: 'star_outline', web: 'star_outline' },
} as const;

type Props = {
  onBack: () => void;
  onOpenNotification: (notification: AppNotification) => void;
};

function NotificationRow({ notification, onPress }: { notification: AppNotification; onPress: () => void }) {
  const tint = notification.category === 'order' ? colors.blue
    : notification.category === 'listing' ? colors.amber
      : notification.category === 'system' ? colors.red : colors.forest;
  const background = notification.category === 'order' ? colors.blueSoft
    : notification.category === 'listing' ? colors.amberSoft
      : notification.category === 'system' ? colors.redSoft : colors.mint;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${notification.title}. ${notification.description}. ${notification.action}${notification.unread ? '. Unread' : ''}`}
      onPress={onPress}
      style={[styles.row, notification.unread && styles.unreadRow]}
    >
      <View style={[styles.iconBox, { backgroundColor: background }]}>
        <SymbolView name={icons[notification.icon]} size={20} tintColor={tint} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{notification.title}</Text>
        <Text style={styles.description}>{notification.description}</Text>
        <Text style={styles.meta}>{notification.meta}</Text>
      </View>
      <View style={styles.rowEnd}>
        {notification.unread && <View style={styles.unreadDot} />}
        <Text style={styles.action}>{notification.action}</Text>
      </View>
    </Pressable>
  );
}

export function NotificationsScreen({ onBack, onOpenNotification }: Props) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<NotificationCategory | 'all'>('all');
  const notifications = useSyncExternalStore(notificationStore.subscribe, notificationStore.getSnapshot, notificationStore.getSnapshot);
  const visible = notifications.filter((item) => filter === 'all' || item.category === filter);
  const unreadCount = notifications.filter((item) => item.unread).length;

  function open(notification: AppNotification) {
    notificationStore.markRead(notification.id);
    onOpenNotification(notification);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={8} style={styles.backButton}>
          <SymbolView name={icons.back} size={18} tintColor={colors.forest} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Updates about buying and selling</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
          accessibilityState={{ disabled: unreadCount === 0 }}
          disabled={unreadCount === 0}
          onPress={notificationStore.markAllRead}
          style={[styles.markAll, unreadCount === 0 && styles.markAllDisabled]}
        >
          <Text style={styles.markAllText}>Mark all read</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityLabel="Notification filters">
          {filters.map((item) => {
            const selected = filter === item.value;
            return (
              <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setFilter(item.value)} style={[styles.filter, selected && styles.selectedFilter]}>
                <Text style={[styles.filterText, selected && styles.selectedFilterText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {(['today', 'earlier'] as const).map((section) => {
          const sectionItems = visible.filter((item) => item.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <View key={section} style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>{section === 'today' ? 'TODAY' : 'EARLIER'}</Text>
                <Text style={styles.sectionCount}>{sectionItems.length} {sectionItems.length === 1 ? 'update' : 'updates'}</Text>
              </View>
              {sectionItems.map((notification) => <NotificationRow key={notification.id} notification={notification} onPress={() => open(notification)} />)}
            </View>
          );
        })}

        {visible.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No notifications in this category</Text>
            <Text style={styles.emptyText}>Your new updates will appear here.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: '700', color: colors.forest },
  subtitle: { marginTop: 2, fontSize: 11, color: colors.muted },
  markAll: { minHeight: 36, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  markAllDisabled: { opacity: 0.55 },
  markAllText: { fontSize: 10, fontWeight: '700', color: colors.forest },
  content: { paddingHorizontal: 16 },
  filters: { gap: 7, paddingTop: 15, paddingBottom: 14 },
  filter: { minHeight: 32, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  selectedFilter: { backgroundColor: colors.forest, borderColor: colors.forest },
  filterText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  selectedFilterText: { color: '#fff' },
  section: { marginTop: 2 },
  sectionHeading: { minHeight: 36, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 10, letterSpacing: 0.6, fontWeight: '700', color: colors.muted },
  sectionCount: { fontSize: 10, color: colors.muted },
  row: { minHeight: 88, flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 4, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#edf2ee' },
  unreadRow: { backgroundColor: colors.soft },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 12, lineHeight: 17, fontWeight: '700', color: colors.ink },
  description: { marginTop: 3, fontSize: 11, lineHeight: 15, color: colors.muted },
  meta: { marginTop: 9, fontSize: 9, lineHeight: 12, color: '#87928b' },
  rowEnd: { width: 42, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  action: { fontSize: 10, fontWeight: '700', color: colors.forest },
  empty: { marginTop: 24, padding: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 14, alignItems: 'center' },
  emptyTitle: { fontSize: 13, fontWeight: '700', color: colors.forest },
  emptyText: { marginTop: 4, fontSize: 11, color: colors.muted },
});
