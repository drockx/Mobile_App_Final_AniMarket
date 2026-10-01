import { NavigationIcon } from '@/components/navigation_icon';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketplaceBottomBar } from '@/components/marketplace_bottom_bar';

import { useAccount } from '../profile_store';
import { verificationLabels } from '../domain/identity_verification';
import { ProfilePicture } from './components/profile_picture';

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
  check: { ios: 'checkmark.seal', android: 'verified', web: 'verified' },
  listings: { ios: 'list.bullet.rectangle', android: 'list_alt', web: 'list_alt' },
  orders: { ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' },
  messages: { ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' },
  calculator: { ios: 'percent', android: 'calculate', web: 'calculate' },
  chart: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  person: { ios: 'person', android: 'person_outline', web: 'person_outline' },
  lock: { ios: 'lock', android: 'lock_outline', web: 'lock_outline' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
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
  symbol,
  badge,
  destructive = false,
  last = false,
  onPress,
}: {
  title: string;
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
      </View>
      {badge ? <Text style={styles.count}>{badge}</Text> : <NavigationIcon name="next" />}
    </Pressable>
  );
}

type ProfileScreenProps = {
  activeListingCount: number;
  orderCount: number;
  unreadMessageCount: number;
  onMyListings: () => void;
  onMyOrders: () => void;
  onMessages: () => void;
  onMarketReference: () => void;
  onPriceCalculator: () => void;
  onPersonalInformation: () => void;
  onAccountSecurity: () => void;
  onVerification: () => void;
  onIdReviews: () => void;
  onLogOut: () => void;
};

export function ProfileScreen({ activeListingCount, orderCount, unreadMessageCount, onMyListings, onMyOrders, onMessages, onMarketReference, onPriceCalculator, onPersonalInformation, onAccountSecurity, onVerification, onIdReviews, onLogOut }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const account = useAccount();
  const initials = account.personal.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AM';

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
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.profileCard}>
            <View style={styles.identity}>
              <ProfilePicture key={account.userId} initials={initials} compact={compact} />
              <View style={styles.identityCopy}>
                <View style={styles.identityTopRow}>
                  <Text numberOfLines={2} style={styles.personName}>{account.personal.fullName || 'AniMarket Member'}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit Profile"
                    hitSlop={6}
                    onPress={onPersonalInformation}
                    style={styles.editButton}
                  >
                    <Text style={styles.editText}>Edit Profile</Text>
                  </Pressable>
                </View>
                <Text style={styles.location}>{account.personal.city}, Davao del Norte</Text>
                <View style={styles.verifiedRow}>
                  {account.verification.status === 'verified' && <View style={styles.verifiedIcon}><Icon name={icon.check} size={14} tintColor={color.green} /></View>}
                  <Text style={styles.verifiedText}>{account.verification.status === 'verified' ? 'Identity verified' : 'AniMarket member'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.stats}>
              {[['—', 'RATING'], [String(activeListingCount), 'ACTIVE LISTINGS'], [String(orderCount), 'ORDERS']].map(([value, label], index) => (
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
              onPress={onMyListings}
            />
            <QuickAction
              title="My Orders"
              symbol={icon.orders}
              onPress={onMyOrders}
            />
          </View>

          <View style={[styles.sectionHeading, styles.activityHeading]}>
            <Text style={styles.sectionTitle}>MARKETPLACE ACTIVITY</Text>
          </View>
          <View style={styles.menu}>
            <MenuItem title="Messages" symbol={icon.messages} badge={unreadMessageCount > 0 ? `${unreadMessageCount} unread` : undefined} onPress={onMessages} />
            <MenuItem title="Price Calculator" symbol={icon.calculator} onPress={onPriceCalculator} />
            <MenuItem title="Davao del Norte Market Reference" symbol={icon.chart} onPress={onMarketReference} last />
          </View>

          <View style={styles.accountGroup}>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>ACCOUNT</Text></View>
            <View style={styles.verification}>
              <View style={styles.verificationCopy}>
                <Text style={styles.verificationTitle}>{verificationLabels[account.verification.status]}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Open account verification" onPress={onVerification} style={styles.completeButton}>
                <Text style={styles.completeText}>{account.verification.status === 'unverified' ? 'Verify' : 'View'}</Text>
              </Pressable>
            </View>
            <View style={styles.menu}>
              <MenuItem title="Personal Information" symbol={icon.person} onPress={onPersonalInformation} />
              {account.isReviewer && <MenuItem title="ID Reviews" symbol={icon.check} onPress={onIdReviews} />}
              <MenuItem title="Account & Security" symbol={icon.lock} onPress={onAccountSecurity} />
              <MenuItem title="Log Out" symbol={icon.logout} destructive onPress={confirmLogOut} last />
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
  headerTitle: { color: color.forest, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  content: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 20, gap: 12 },
  profileCard: { padding: 15, paddingBottom: 20, borderRadius: 18, borderWidth: 1, borderColor: color.line, backgroundColor: '#fff', shadowColor: color.forest, shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  identityCopy: { flex: 1, minWidth: 0 },
  identityTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  personName: { flex: 1, minWidth: 0, color: color.forest, fontSize: 17, lineHeight: 22, fontWeight: '700' },
  location: { color: '#54645a', fontSize: 13, lineHeight: 18, marginTop: 2 },
  verifiedRow: { minHeight: 18, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  verifiedIcon: { width: 15, height: 15, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { flexShrink: 1, color: color.green, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  editButton: { minWidth: 84, minHeight: 34, borderWidth: 1, borderColor: color.line, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  editText: { color: color.forest, fontSize: 12, lineHeight: 16, fontWeight: '800', textAlign: 'center' },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: color.line, marginTop: 12, paddingTop: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { borderRightWidth: 1, borderRightColor: color.line },
  statValue: { color: color.forest, fontSize: 17, lineHeight: 21, fontWeight: '700' },
  statLabel: { color: '#54645a', fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  quickGrid: { flexDirection: 'row', gap: 9 },
  quickAction: { flex: 1, minHeight: 60, borderWidth: 1, borderColor: color.line, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff' },
  quickIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: color.mint },
  quickCopy: { flex: 1, minWidth: 0 },
  quickTitle: { color: color.forest, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  sectionHeading: { marginHorizontal: 2, marginTop: 2, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  activityHeading: { marginTop: 2 },
  sectionTitle: { color: '#52665b', fontSize: 14, lineHeight: 20, letterSpacing: 0.45, fontWeight: '700' },
  accountGroup: { gap: 10 },
  menu: { borderWidth: 1, borderColor: color.line, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff' },
  menuItem: { minHeight: 60, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff' },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: '#edf2ee' },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  logoutIcon: { backgroundColor: '#fff1ef' },
  menuCopy: { flex: 1, minWidth: 0 },
  menuTitle: { color: color.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  logoutText: { color: color.red },
  count: { color: color.forest, backgroundColor: color.mint, borderRadius: 20, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 5, fontSize: 12, lineHeight: 16, fontWeight: '800' },
  verification: { minHeight: 52, borderWidth: 1, borderColor: '#eddcab', borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff7df' },
  verificationCopy: { flex: 1 },
  verificationTitle: { color: '#684500', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  completeButton: { minWidth: 64, minHeight: 44, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  completeText: { color: '#805300', fontSize: 12, lineHeight: 16, fontWeight: '800', textAlign: 'center' },
});
