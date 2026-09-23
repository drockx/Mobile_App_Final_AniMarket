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
        <Text numberOfLines={2} style={styles.cardDetails}>{listing.details}</Text>
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
          accessibilityState={{ disabled: !tab.active, selected: tab.active }}
          disabled={!tab.active}
          style={[styles.tab, !tab.active && styles.tabDisabled]}
        >
          <Icon name={tab.icon} size={21} color={tab.active ? palette.green : '#93a7c0'} />
          <Text numberOfLines={2} style={[styles.tabLabel, tab.active && styles.tabLabelActive]}>{tab.label}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create listing"
        accessibilityState={{ disabled: true }}
        disabled
        style={[styles.addTab, styles.tabDisabled]}
      >
        <View style={styles.addCircle}><Icon name={icons.add} size={24} color="#fff" /></View>
      </Pressable>
      {tabs.slice(2).map((tab) => (
        <Pressable
          key={tab.label}
          accessibilityRole="button"
          accessibilityLabel={tab.label}
          accessibilityState={{ disabled: true }}
          disabled
          style={[styles.tab, styles.tabDisabled]}
        >
          <Icon name={tab.icon} size={21} color="#93a7c0" />
          <Text numberOfLines={2} style={styles.tabLabel}>{tab.label}</Text>
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
          <Icon name={icons.location} size={20} />
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
            <Icon name={icons.notification} size={20} />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Icon name={icons.search} size={19} color="#7f93a9" />
          <TextInput
            accessibilityLabel="Search livestock"
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="Search pigs, cows, chickens, goats..."
            placeholderTextColor="#5d6d80"
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show all categories"
            hitSlop={4}
            onPress={() => setCategory(null)}
            style={styles.sectionActionButton}
          >
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
            accessibilityLabel="Verified sellers only"
            accessibilityState={{ selected: verifiedOnly }}
            onPress={() => setVerifiedOnly((value) => !value)}
            style={[styles.filterButton, verifiedOnly && styles.filterButtonSelected]}
          >
            <Text style={[styles.filterText, verifiedOnly && styles.filterTextSelected]}>
              Verified only
            </Text>
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
  content: { paddingHorizontal: 18, paddingBottom: 92 },
  locationRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center' },
  locationText: { marginLeft: 7, flex: 1 },
  locationCaption: { color: '#768aa2', fontSize: 11, letterSpacing: 0.7, lineHeight: 14 },
  locationName: { color: palette.green, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  notificationButton: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: palette.border,
    alignItems: 'center', justifyContent: 'center',
  },
  notificationDot: { position: 'absolute', top: 9, right: 10, width: 5, height: 5, borderRadius: 3, backgroundColor: '#d14f55' },
  searchBox: {
    minHeight: 46, borderRadius: 14, borderColor: palette.border, borderWidth: 1,
    backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13,
    shadowColor: '#416274', shadowOpacity: 0.07, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  searchInput: { flex: 1, minHeight: 44, marginLeft: 8, color: palette.ink, fontSize: 14, paddingVertical: 0 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  sectionTitle: { color: palette.green, fontSize: 17, fontWeight: '700' },
  sectionActionButton: { minHeight: 44, minWidth: 52, alignItems: 'flex-end', justifyContent: 'center' },
  sectionAction: { color: palette.green, fontSize: 13, fontWeight: '600' },
  chipRow: { gap: 10, paddingTop: 7, paddingBottom: 1 },
  chip: {
    minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: '#fff',
    borderColor: palette.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  chipSelected: { backgroundColor: palette.green, borderColor: palette.green },
  chipText: { color: '#455263', fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  sellerBanner: {
    minHeight: 82, borderRadius: 14, backgroundColor: '#245e49', marginTop: 20,
    paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#123c2d', shadowOpacity: 0.18, shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  bannerCopy: { flex: 1, paddingRight: 10 },
  bannerTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  bannerSubtitle: { color: '#dce9e4', fontSize: 12, lineHeight: 16, maxWidth: 210 },
  learnButton: { minHeight: 44, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  learnText: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  listingHeading: { marginTop: 18 },
  filterButton: {
    minHeight: 44, paddingHorizontal: 12, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: palette.border, backgroundColor: '#fff',
  },
  filterButtonSelected: { backgroundColor: palette.green, borderColor: palette.green },
  filterText: { color: palette.green, fontSize: 12, fontWeight: '700' },
  filterTextSelected: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginTop: 8 },
  card: {
    width: '48%', backgroundColor: '#fff', borderRadius: 13, overflow: 'hidden',
    borderWidth: 1, borderColor: '#e1e8ee', shadowColor: '#526981', shadowOpacity: 0.10,
    shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardImage: { width: '100%', aspectRatio: 1.43 },
  cardBody: { paddingHorizontal: 9, paddingTop: 8, paddingBottom: 10 },
  cardTitle: { color: '#1b2730', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  cardDetails: { color: '#73849a', fontSize: 11, lineHeight: 15 },
  price: { color: palette.green, fontSize: 14, fontWeight: '800', lineHeight: 19, marginTop: 2 },
  emptyState: { color: palette.muted, textAlign: 'center', marginTop: 35, fontSize: 14 },
  bottomBar: {
    minHeight: 66, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around',
    paddingTop: 6, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e9eef3',
  },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
  tabDisabled: { opacity: 0.58 },
  tabLabel: { color: '#7f91a8', fontSize: 10, lineHeight: 12, textAlign: 'center' },
  tabLabelActive: { color: palette.green, fontWeight: '700' },
  addTab: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  addCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: palette.green,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.20, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
});
