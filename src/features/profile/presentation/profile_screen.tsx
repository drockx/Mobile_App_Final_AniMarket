import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketplaceBottomBar } from '@/components/marketplace_bottom_bar';

const color = {
  forest: '#12372a',
  green: '#2d6a4f',
  mint: '#eaf5ed',
  surface: '#f8fbf9',
  line: '#dfe8e2',
  text: '#17221d',
  muted: '#6b776f',
  red: '#b42318',
} as const;

const icon = {
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  check: { ios: 'checkmark.seal', android: 'verified', web: 'verified' },
  listings: { ios: 'list.bullet.rectangle', android: 'list_alt', web: 'list_alt' },
  orders: { ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' },
  messages: { ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' },
  calculator: { ios: 'percent', android: 'calculate', web: 'calculate' },
  chart: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  person: { ios: 'person', android: 'person_outline', web: 'person_outline' },
  lock: { ios: 'lock', android: 'lock_outline', web: 'lock_outline' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
} as const;

type IconName = React.ComponentProps<typeof SymbolView>['name'];

function Icon({ name, size = 19, tintColor = color.forest }: { name: IconName; size?: number; tintColor?: string }) {
  return <SymbolView name={name} size={size} tintColor={tintColor} />;
}

function QuickAction({
  title,
  symbol,
  onPress,
}: {
  title: string;
  symbol: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.quickAction}>
      <View style={styles.quickIcon}><Icon name={symbol} /></View>
      <View style={styles.quickCopy}>
        <Text style={styles.quickTitle}>{title}</Text>
      </View>
    </Pressable>
  );
}

function MenuItem({
  title,
  description,
  symbol,
  badge,
  destructive = false,
  last = false,
  onPress,
}: {
  title: string;
  description?: string;
  symbol: IconName;
  badge?: string;
  destructive?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={[styles.menuItem, !last && styles.menuDivider]}
    >
      <View style={[styles.menuIcon, destructive && styles.logoutIcon]}>
        <Icon name={symbol} size={19} tintColor={destructive ? color.red : color.forest} />
      </View>
      <View style={styles.menuCopy}>
        <Text style={[styles.menuTitle, destructive && styles.logoutText]}>{title}</Text>
        {description && <Text numberOfLines={2} style={styles.menuDescription}>{description}</Text>}
      </View>
      {badge ? <Text style={styles.count}>{badge}</Text> : <Icon name={icon.chevron} size={15} tintColor="#8a968e" />}
    </Pressable>
  );
}

type ProfileScreenProps = {
  onMessages: () => void;
  onLogOut: () => void;
};

export function ProfileScreen({ onMessages, onLogOut }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 360;

  const showUnavailable = (title: string) => {
    if (Platform.OS === 'web') window.alert(`${title} is coming soon.`);
    else Alert.alert(title, `${title} is coming soon.`);
  };
  const confirmLogOut = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Log out of AniMarket?')) onLogOut();
      return;
    }
    Alert.alert('Log out of AniMarket?', 'You can sign in again at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: onLogOut },
    ]);
  };

  return (
    <View style={styles.background}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 9 }]}>
          <View>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={3}
            onPress={() => showUnavailable('Settings')}
            style={styles.settingsButton}
          >
            <Icon name={icon.settings} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.profileCard}>
            <View style={styles.identity}>
              <View style={[styles.avatar, compact && styles.avatarCompact]}>
                <Text style={styles.avatarText}>JD</Text>
                <View style={styles.onlineDot} />
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.personName}>Juan Dela Cruz</Text>
                <Text style={styles.location}>Tagum City, Davao del Norte</Text>
                <View style={styles.verifiedRow}>
                  <Icon name={icon.check} size={12} tintColor={color.green} />
                  <Text style={styles.verifiedText}>Verified AniMarket member</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit Profile"
                hitSlop={6}
                onPress={() => showUnavailable('Edit Profile')}
                style={styles.editButton}
              >
                <Text style={styles.editText}>Edit Profile</Text>
              </Pressable>
            </View>

            <View style={styles.verification}>
              <View style={styles.verificationCopy}>
                <Text style={styles.verificationTitle}>Account verification: 75% complete</Text>
                <Text style={styles.verificationDescription}>Add a valid ID and contact details to improve buyer trust and listing visibility.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Complete account verification" hitSlop={7} onPress={() => showUnavailable('Account verification')} style={styles.completeButton}>
                <Text style={styles.completeText}>Complete</Text>
              </Pressable>
            </View>

            <View style={styles.stats}>
              {[['4.8', 'RATING'], ['8', 'ACTIVE LISTINGS'], ['12', 'ORDERS']].map(([value, label], index) => (
                <View key={label} style={[styles.stat, index < 2 && styles.statDivider]}>
                  <Text style={styles.statValue}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.quickGrid}>
            <QuickAction
              title="My Listings"
              symbol={icon.listings}
              onPress={() => showUnavailable('My Listings')}
            />
            <QuickAction
              title="My Orders"
              symbol={icon.orders}
              onPress={() => showUnavailable('My Orders')}
            />
          </View>

          <View style={[styles.sectionHeading, styles.activityHeading]}>
            <Text style={styles.sectionTitle}>MARKETPLACE ACTIVITY</Text>
          </View>
          <View style={styles.menu}>
            <MenuItem title="Messages" symbol={icon.messages} badge="3 unread" onPress={onMessages} />
            <MenuItem title="Price Calculator" symbol={icon.calculator} onPress={() => showUnavailable('Price Calculator')} />
            <MenuItem title="Davao Regional Market Reference" symbol={icon.chart} onPress={() => showUnavailable('Davao Regional Market Reference')} last />
          </View>

          <View style={styles.accountGroup}>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>ACCOUNT</Text></View>
            <View style={styles.menu}>
              <MenuItem title="Personal Information" description="Name, phone number, and complete address" symbol={icon.person} onPress={() => showUnavailable('Personal Information')} />
              <MenuItem title="Account & Security" description="Password, sign-in methods, and privacy" symbol={icon.lock} onPress={() => showUnavailable('Account & Security')} />
              <MenuItem title="Log Out" description="Sign out of this device" symbol={icon.logout} destructive onPress={confirmLogOut} last />
            </View>
          </View>
        </ScrollView>

        <MarketplaceBottomBar activeTab="profile" bottomInset={insets.bottom} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: color.surface },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: color.surface },
  header: { paddingHorizontal: 15, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: color.line },
  headerTitle: { color: color.forest, fontSize: 20, lineHeight: 25, fontWeight: '700' },
  settingsButton: { width: 38, height: 38, borderWidth: 1, borderColor: color.line, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  content: { flexGrow: 1, paddingHorizontal: 15, paddingTop: 14, paddingBottom: 28, gap: 14 },
  profileCard: { padding: 15, borderRadius: 18, borderWidth: 1, borderColor: color.line, backgroundColor: '#fff', shadowColor: color.forest, shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.mint },
  avatarCompact: { width: 55, height: 55 },
  avatarText: { color: color.forest, fontSize: 20, fontWeight: '800' },
  onlineDot: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: '#fff', backgroundColor: '#36a269' },
  identityCopy: { flex: 1, minWidth: 0 },
  personName: { color: color.forest, fontSize: 16, lineHeight: 20, fontWeight: '700' },
  location: { color: color.muted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  verifiedText: { color: color.green, fontSize: 8, lineHeight: 11, fontWeight: '800' },
  editButton: { minWidth: 72, minHeight: 32, borderWidth: 1, borderColor: color.line, borderRadius: 9, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  editText: { color: color.forest, fontSize: 8.5, fontWeight: '800' },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: color.line, marginTop: 8, paddingTop: 10 },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { borderRightWidth: 1, borderRightColor: color.line },
  statValue: { color: color.forest, fontSize: 16, lineHeight: 19, fontWeight: '700' },
  statLabel: { color: color.muted, fontSize: 7.5, lineHeight: 10, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  quickGrid: { flexDirection: 'row', gap: 9, marginTop: 6 },
  quickAction: { flex: 1, minHeight: 98, borderWidth: 1, borderColor: color.line, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#fff' },
  quickIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: color.mint },
  quickCopy: { flex: 1, minWidth: 0 },
  quickTitle: { color: color.forest, fontSize: 11, lineHeight: 14, fontWeight: '700', marginTop: 2 },
  sectionHeading: { marginHorizontal: 2, marginTop: 2, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  activityHeading: { marginTop: 28 },
  sectionTitle: { color: color.muted, fontSize: 11, lineHeight: 14, letterSpacing: 0.45, fontWeight: '700' },
  accountGroup: { marginTop: 'auto', gap: 20 },
  menu: { borderWidth: 1, borderColor: color.line, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff' },
  menuItem: { minHeight: 62, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff' },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: '#edf2ee' },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  logoutIcon: { backgroundColor: '#fff1ef' },
  menuCopy: { flex: 1, minWidth: 0 },
  menuTitle: { color: color.text, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  menuDescription: { color: color.muted, fontSize: 9, lineHeight: 12, marginTop: 2 },
  logoutText: { color: color.red },
  count: { color: color.forest, backgroundColor: color.mint, borderRadius: 20, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 5, fontSize: 8, fontWeight: '800' },
  verification: { minHeight: 92, marginHorizontal: -15, marginTop: 10, borderWidth: 1, borderColor: '#eddcab', borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff7df' },
  verificationCopy: { flex: 1 },
  verificationTitle: { color: '#684500', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  verificationDescription: { color: '#846728', fontSize: 8.5, lineHeight: 12, marginTop: 3 },
  completeButton: { minWidth: 56, minHeight: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  completeText: { color: '#9a6700', fontSize: 8, fontWeight: '800' },
});
