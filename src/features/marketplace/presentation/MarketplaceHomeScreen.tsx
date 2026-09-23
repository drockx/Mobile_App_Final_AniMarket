import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listings } from '../data/listings';
import { filterListings, type Listing, type LivestockCategory } from '../domain/listing';

const palette = {
  green: '#17392e',
  greenLight: '#25634f',
  ink: '#21312e',
  muted: '#78899c',
  border: '#dce6f0',
  surface: '#fcfefd',
};

const categories: LivestockCategory[] = ['Pig', 'Cow', 'Chicken', 'Goat'];

type IconName = React.ComponentProps<typeof SymbolView>['name'];

function Icon({ name, size = 19, color = palette.green }: { name: IconName; size?: number; color?: string }) {
  return <SymbolView name={name} size={size} tintColor={color} />;
}

const icons = {
  location: { ios: 'mappin.circle', android: 'location_on', web: 'location_on' },
  notification: { ios: 'bell', android: 'notifications_none', web: 'notifications_none' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  home: { ios: 'house', android: 'home', web: 'home' },
  messages: { ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  chart: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  profile: { ios: 'person.crop.circle', android: 'person_outline', web: 'person_outline' },
} as const;

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <View style={styles.card}>
      <Image source={listing.image} contentFit="cover" style={styles.cardImage} />
      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={styles.cardTitle}>{listing.title}</Text>
        <Text numberOfLines={1} style={styles.cardDetails}>{listing.details}</Text>
        <Text style={styles.price}>₱{listing.price.toLocaleString('en-PH')}</Text>
      </View>
    </View>
  );
}

function BottomBar({ bottomInset }: { bottomInset: number }) {
  const tabs = [
    { label: 'Home', icon: icons.home, active: true },
    { label: 'Messages', icon: icons.messages },
    { label: 'Market Reference', icon: icons.chart },
    { label: 'Profile', icon: icons.profile },
  ];

  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {tabs.slice(0, 2).map((tab) => (
        <Pressable
          key={tab.label}
          accessibilityRole="button"
          accessibilityLabel={tab.label}
          onPress={() => tab.active ? undefined : Alert.alert(tab.label, 'This section is coming soon.')}
          style={styles.tab}
        >
          <Icon name={tab.icon} size={20} color={tab.active ? palette.green : '#93a7c0'} />
          <Text numberOfLines={1} style={[styles.tabLabel, tab.active && styles.tabLabelActive]}>{tab.label}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create listing"
        onPress={() => Alert.alert('Create listing', 'Listing creation is coming soon.')}
        style={styles.addTab}
      >
        <View style={styles.addCircle}><Icon name={icons.add} size={22} color="#fff" /></View>
      </Pressable>
      {tabs.slice(2).map((tab) => (
        <Pressable
          key={tab.label}
          accessibilityRole="button"
          accessibilityLabel={tab.label}
          onPress={() => Alert.alert(tab.label, 'This section is coming soon.')}
          style={styles.tab}
        >
          <Icon name={tab.icon} size={20} color="#93a7c0" />
          <Text numberOfLines={1} style={styles.tabLabel}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function MarketplaceHomeScreen() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<LivestockCategory | null>('Pig');
  const [query, setQuery] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const visibleListings = useMemo(
    () => filterListings(listings, category, query, verifiedOnly),
    [category, query, verifiedOnly],
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 13 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.locationRow}>
          <Icon name={icons.location} size={19} />
          <View style={styles.locationText}>
            <Text style={styles.locationCaption}>LOCATION</Text>
            <Text style={styles.locationName}>Davao City, PH</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => Alert.alert('Notifications', 'You have no new notifications.')}
            style={styles.notificationButton}
          >
            <Icon name={icons.notification} size={19} />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Icon name={icons.search} size={18} color="#91a5bb" />
          <TextInput
            accessibilityLabel="Search livestock"
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="Search pigs, cows, chickens, goats..."
            placeholderTextColor="#465568"
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <Pressable onPress={() => setCategory(null)} accessibilityRole="button">
            <Text style={styles.sectionAction}>See all</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {categories.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: category === item }}
              onPress={() => setCategory(item)}
              style={[styles.chip, category === item && styles.chipSelected]}
            >
              <Text style={[styles.chipText, category === item && styles.chipTextSelected]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sellerBanner}>
          <View style={styles.bannerCopy}>
            <Text style={styles.bannerTitle}>Verified Sellers Only</Text>
            <Text style={styles.bannerSubtitle}>Trade with confidence in your local area.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => Alert.alert('Verified sellers', 'Verified sellers have completed identity checks.')}
            style={styles.learnButton}
          >
            <Text style={styles.learnText}>Learn More</Text>
          </Pressable>
        </View>

        <View style={[styles.sectionHeading, styles.listingHeading]}>
          <Text style={styles.sectionTitle}>Fresh Listings</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: verifiedOnly }}
            onPress={() => setVerifiedOnly((value) => !value)}
          >
            <Text style={styles.sectionAction}>{verifiedOnly ? 'Verified' : 'Filter'}</Text>
          </Pressable>
        </View>
        {visibleListings.length ? (
          <View style={styles.grid}>
            {visibleListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </View>
        ) : (
          <Text style={styles.emptyState}>No listings match your search.</Text>
        )}
      </ScrollView>
      <BottomBar bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.surface },
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  locationRow: { height: 54, flexDirection: 'row', alignItems: 'center' },
  locationText: { marginLeft: 6, flex: 1 },
  locationCaption: { color: '#768aa2', fontSize: 10, letterSpacing: 0.7, lineHeight: 13 },
  locationName: { color: palette.green, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  notificationButton: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: palette.border,
    alignItems: 'center', justifyContent: 'center', marginRight: 5,
  },
  notificationDot: { position: 'absolute', top: 6, right: 7, width: 4, height: 4, borderRadius: 2, backgroundColor: '#d14f55' },
  searchBox: {
    height: 36, borderRadius: 12, borderColor: palette.border, borderWidth: 1,
    backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    shadowColor: '#416274', shadowOpacity: 0.07, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  searchInput: { flex: 1, height: '100%', marginLeft: 8, color: palette.ink, fontSize: 13, paddingVertical: 0 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 17 },
  sectionTitle: { color: palette.green, fontSize: 15, fontWeight: '700' },
  sectionAction: { color: palette.green, fontSize: 11, fontWeight: '500' },
  chipRow: { gap: 10, paddingTop: 10, paddingBottom: 1 },
  chip: {
    height: 30, paddingHorizontal: 14, borderRadius: 17, backgroundColor: '#fff',
    borderColor: palette.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  chipSelected: { backgroundColor: palette.green, borderColor: palette.green },
  chipText: { color: '#455263', fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  sellerBanner: {
    minHeight: 74, borderRadius: 13, backgroundColor: '#245e49', marginTop: 22,
    paddingHorizontal: 18, paddingVertical: 13, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#123c2d', shadowOpacity: 0.18, shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  bannerCopy: { flex: 1, paddingRight: 10 },
  bannerTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  bannerSubtitle: { color: '#dce9e4', fontSize: 11, lineHeight: 13, maxWidth: 200 },
  learnButton: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  learnText: { color: palette.ink, fontSize: 11, fontWeight: '700' },
  listingHeading: { marginTop: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginTop: 10 },
  card: {
    width: '48%', backgroundColor: '#fff', borderRadius: 13, overflow: 'hidden',
    borderWidth: 1, borderColor: '#e1e8ee', shadowColor: '#526981', shadowOpacity: 0.10,
    shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardImage: { width: '100%', aspectRatio: 1.43 },
  cardBody: { paddingHorizontal: 9, paddingTop: 8, paddingBottom: 9 },
  cardTitle: { color: '#1b2730', fontSize: 11, fontWeight: '700', lineHeight: 16 },
  cardDetails: { color: '#8595a9', fontSize: 10, lineHeight: 14 },
  price: { color: palette.green, fontSize: 13, fontWeight: '800', lineHeight: 18, marginTop: 1 },
  emptyState: { color: palette.muted, textAlign: 'center', marginTop: 35, fontSize: 13 },
  bottomBar: {
    minHeight: 58, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around',
    paddingTop: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e9eef3',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { color: '#90a0b5', fontSize: 9 },
  tabLabelActive: { color: palette.green, fontWeight: '600' },
  addTab: { width: 42, alignItems: 'center', justifyContent: 'center' },
  addCircle: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: palette.green,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
});
