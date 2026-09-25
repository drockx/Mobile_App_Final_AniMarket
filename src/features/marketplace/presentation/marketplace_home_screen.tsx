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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketplaceBottomBar } from '@/components/marketplace_bottom_bar';

import type { MarketplaceService } from '../application/marketplace_service';
import type { Listing, LivestockCategory } from '../domain/listing';
import { toListingCriteria, type SearchFilters } from './search_filters';
import { getListingImage } from './listing_images';

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
} as const;

function ListingCard({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${listing.title} details`} onPress={onPress} style={styles.card}>
      <Image source={getListingImage(listing.id)} contentFit="cover" style={styles.cardImage} />
      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={styles.cardTitle}>{listing.title}</Text>
        <Text numberOfLines={1} style={styles.cardDetails}>{listing.details}</Text>
        <Text style={styles.price}>₱{listing.price.toLocaleString('en-PH')}</Text>
      </View>
    </Pressable>
  );
}

type MarketplaceHomeScreenProps = {
  marketplace: MarketplaceService;
  routeFilters: SearchFilters;
  routeKey: string;
  onOpenListing: (id: string) => void;
  onOpenFilters: (filters: SearchFilters) => void;
};

export function MarketplaceHomeScreen({
  marketplace,
  routeFilters,
  routeKey,
  onOpenListing,
  onOpenFilters,
}: MarketplaceHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const [categoryDraft, setCategoryDraft] = useState<{ routeKey: string; value: LivestockCategory | null } | null>(null);
  const [verifiedDraft, setVerifiedDraft] = useState<{ routeKey: string; value: boolean } | null>(null);
  const category = categoryDraft?.routeKey === routeKey ? categoryDraft.value : routeFilters.category;
  const query = routeFilters.query;
  const verifiedOnly = verifiedDraft?.routeKey === routeKey ? verifiedDraft.value : routeFilters.verifiedOnly;

  const visibleListings = useMemo(
    () => marketplace.findListings(toListingCriteria({
      category,
      query,
      verifiedOnly,
      location: routeFilters.location,
      minPrice: routeFilters.minPrice,
      maxPrice: routeFilters.maxPrice,
      vaccinatedOnly: routeFilters.vaccinatedOnly,
      sort: routeFilters.sort,
    })),
    [category, query, routeFilters.location, routeFilters.minPrice, routeFilters.maxPrice,
      verifiedOnly, routeFilters.vaccinatedOnly, routeFilters.sort, marketplace],
  );

  function openFilters() {
    onOpenFilters({ ...routeFilters, category, query, verifiedOnly });
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
            {visibleListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} onPress={() => onOpenListing(listing.id)} />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyState}>No listings match your search or filters.</Text>
        )}
      </ScrollView>

      <MarketplaceBottomBar activeTab="home" bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: palette.surface,
  },
  content: {
    paddingHorizontal: 15,
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

});
