import { useMemo, useState } from 'react';
import { Link, router, useLocalSearchParams, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listings } from '../data/listings';
import { getListingImage } from '../data/listingImages';
import { filterListings, type Listing, type LivestockCategory } from '../domain/listing';
import { numericPrice, parseSearchFilters, serializeSearchFilters } from '../domain/searchFilters';

const palette = {
  green: '#123f32',
  greenSoft: '#296a52',
  ink: '#1d2b27',
  muted: '#8491a6',
  border: '#dde5ee',
  surface: '#f9fcf9',
};

const categoryOptions: { label: string; value: LivestockCategory | null }[] = [
  { label: 'All Livestock', value: null },
  { label: 'Cow', value: 'Cow' },
  { label: 'Goats', value: 'Goat' },
  { label: 'Poultry', value: 'Chicken' },
  { label: 'Pigs', value: 'Pig' },
];

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
    <Link href={{ pathname: '/listings/[id]', params: { id: listing.id } } as unknown as Href} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${listing.title} details`} style={styles.card}>
        <Image source={getListingImage(listing.id)} contentFit="cover" style={styles.cardImage} />
        <View style={styles.cardBody}>
          <Text numberOfLines={1} style={styles.cardTitle}>{listing.title}</Text>
          <Text numberOfLines={1} style={styles.cardDetails}>{listing.details}</Text>
          <Text style={styles.price}>₱{listing.price.toLocaleString('en-PH')}</Text>
        </View>
      </Pressable>
    </Link>
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
    <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 6) }]}>
      {tabs.slice(0, 2).map((tab) => (
        <Pressable
          key={tab.label}
          accessibilityRole="button"
          accessibilityLabel={tab.label}
          accessibilityState={{ disabled: !tab.active, selected: tab.active }}
          disabled={!tab.active}
          style={[styles.tab, !tab.active && styles.tabDisabled]}
        >
          <Icon name={tab.icon} size={22} color={tab.active ? palette.green : '#8fa3bf'} />
          <Text numberOfLines={1} style={[styles.tabLabel, tab.active && styles.tabLabelActive]}>{tab.label}</Text>
        </Pressable>
      ))}

      <View style={styles.addSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create listing"
          accessibilityState={{ disabled: true }}
          disabled
          style={styles.addButton}
        >
          <Icon name={icons.add} size={26} color="#fff" />
        </Pressable>
      </View>

      {tabs.slice(2).map((tab) => (
        <Pressable
          key={tab.label}
          accessibilityRole="button"
          accessibilityLabel={tab.label}
          accessibilityState={{ disabled: true }}
          disabled
          style={[styles.tab, styles.tabDisabled]}
        >
          <Icon name={tab.icon} size={22} color="#8fa3bf" />
          <Text numberOfLines={1} style={styles.tabLabel}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function MarketplaceHomeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const routeFilters = parseSearchFilters(params);
  const routeKey = JSON.stringify(params);
  const [categoryDraft, setCategoryDraft] = useState<{ routeKey: string; value: LivestockCategory | null } | null>(null);
  const [verifiedDraft, setVerifiedDraft] = useState<{ routeKey: string; value: boolean } | null>(null);
  const category = categoryDraft?.routeKey === routeKey ? categoryDraft.value : routeFilters.category;
  const query = routeFilters.query;
  const verifiedOnly = verifiedDraft?.routeKey === routeKey ? verifiedDraft.value : routeFilters.verifiedOnly;

  const visibleListings = useMemo(
    () => filterListings(listings, category, query, verifiedOnly, {
      location: routeFilters.location,
      minPrice: numericPrice(routeFilters.minPrice),
      maxPrice: numericPrice(routeFilters.maxPrice),
      vaccinatedOnly: routeFilters.vaccinatedOnly,
      sort: routeFilters.sort,
    }),
    [category, query, routeFilters.location, routeFilters.minPrice, routeFilters.maxPrice,
      verifiedOnly, routeFilters.vaccinatedOnly, routeFilters.sort],
  );

  function openFilters() {
    router.push({
      pathname: '/search-filter',
      params: params.applied === 'true'
        ? serializeSearchFilters({ ...routeFilters, category, query, verifiedOnly })
        : { category: category ?? '', query, verifiedOnly: String(verifiedOnly) },
    } as unknown as Href);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
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
            <Icon name={icons.notification} size={20} color="#23352f" />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search livestock"
          onPress={openFilters}
          style={styles.searchBox}
        >
          <Icon name={icons.search} size={18} color="#8ea0b8" />
          <Text numberOfLines={1} style={[styles.searchInput, !query && styles.searchPlaceholder]}>
            {query || 'Search cow, goats, feeds...'}
          </Text>
        </Pressable>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Categories</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {categoryOptions.map((item) => {
            const selected = category === item.value;

            return (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setCategoryDraft({ routeKey, value: item.value })}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sellerBanner}>
          <View style={styles.bannerCopy}>
            <Text style={styles.bannerTitle}>Verified Sellers Only</Text>
            <Text style={styles.bannerSubtitle}>Trade with confidence in your local area.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Learn more about verified sellers"
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
            accessibilityLabel="Filter verified sellers"
            accessibilityState={{ selected: verifiedOnly }}
            hitSlop={10}
            onPress={() => setVerifiedDraft({ routeKey, value: !verifiedOnly })}
            style={[styles.filterButton, verifiedOnly && styles.filterButtonActive]}
          >
            <Text style={[styles.filterText, verifiedOnly && styles.filterTextActive]}>Filter</Text>
          </Pressable>
        </View>

        {visibleListings.length ? (
          <View style={styles.grid}>
            {visibleListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </View>
        ) : (
          <Text style={styles.emptyState}>No listings match your search or filters.</Text>
        )}
      </ScrollView>

      <BottomBar bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 96,
  },

  locationRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    flex: 1,
    marginLeft: 8,
  },
  locationCaption: {
    color: '#73839a',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
  locationName: {
    color: palette.green,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#dce4ed',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#df4d56',
  },

  searchBox: {
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dce4ed',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    shadowColor: '#465c6d',
    shadowOpacity: 0.08,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 9,
    color: palette.ink,
    fontSize: 14,
  },
  searchPlaceholder: {
    color: '#44536a',
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  sectionTitle: {
    color: palette.green,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },

  chipRow: {
    gap: 12,
    paddingTop: 11,
    paddingRight: 6,
    paddingBottom: 2,
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: palette.green,
    borderColor: palette.green,
  },
  chipText: {
    color: '#4b5870',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },

  sellerBanner: {
    minHeight: 84,
    marginTop: 24,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: palette.greenSoft,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#183f31',
    shadowOpacity: 0.22,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  bannerCopy: {
    flex: 1,
    paddingRight: 10,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 3,
  },
  bannerSubtitle: {
    color: '#dceae3',
    fontSize: 12,
    lineHeight: 15,
    maxWidth: 190,
  },
  learnButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnText: {
    color: palette.green,
    fontSize: 12,
    fontWeight: '700',
  },

  listingHeading: {
    marginTop: 22,
  },
  filterButton: {
    minHeight: 32,
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  filterButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: palette.green,
  },
  filterText: {
    color: '#39705a',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  filterTextActive: {
    color: palette.green,
  },

  grid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  card: {
    width: '48%',
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e7ef',
    shadowColor: '#556a7d',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1.38,
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 9,
  },
  cardTitle: {
    color: '#25302d',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  cardDetails: {
    color: '#7f8da2',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  price: {
    color: palette.green,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    marginTop: 2,
  },
  emptyState: {
    color: palette.muted,
    textAlign: 'center',
    marginTop: 36,
    fontSize: 14,
  },

  bottomBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e4e9ef',
    paddingTop: 5,
    shadowColor: '#5d6f7d',
    shadowOpacity: 0.09,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabDisabled: {
    opacity: 0.68,
  },
  tabLabel: {
    color: '#879ab7',
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: palette.green,
    fontWeight: '700',
  },
  addSlot: {
    width: 54,
    minHeight: 52,
    alignItems: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    marginTop: -10,
    borderRadius: 22,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1c2c27',
    shadowOpacity: 0.26,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },
});
