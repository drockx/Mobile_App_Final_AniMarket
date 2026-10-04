import { KeyboardScrollView } from '@/components/keyboard_scroll_view';
import { AppTextInput as TextInput } from '@/components/app_text_input';
import { useState, useSyncExternalStore } from 'react';
import { DataFeedback } from '@/components/data_feedback';
import { NavigationIcon } from '@/components/navigation_icon';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketplaceBottomBar } from '@/components/marketplace_bottom_bar';
import { notificationStore } from '@/features/notifications/notification_store';

import type { MarketplaceService } from '../application/marketplace_service';
import { formatListingAddress, type Listing, type LivestockCategory } from '../domain/listing';
import { hasActiveFilterOptions, toListingCriteria, type SearchFilters } from './search_filters';
import { ListingPhoto } from './listing_photo';
import { appColors } from '@/constants/app_theme';
import { platformShadow } from '@/constants/platform_shadow';

const palette = {
  green: appColors.forest,
  greenSoft: '#296a52',
  ink: '#1d2b27',
  muted: appColors.muted,
  border: '#dde5ee',
  surface: '#f9fcf9',
};

const categoryOptions: { label: string; value: LivestockCategory | null }[] = [
  { label: 'All Livestock', value: null },
  { label: 'Cow', value: 'Cow' },
  { label: 'Pig', value: 'Pig' },
  { label: 'Goat', value: 'Goat' },
  { label: 'Chicken', value: 'Chicken' },
];

type IconName = React.ComponentProps<typeof SymbolView>['name'];

function Icon({ name, size = 19, color = palette.green }: { name: IconName; size?: number; color?: string }) {
  return <SymbolView name={name} size={size} tintColor={color} />;
}

const icons = {
  location: { ios: 'mappin.circle', android: 'location_on', web: 'location_on' },
  notification: { ios: 'bell', android: 'notifications_none', web: 'notifications_none' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  filter: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
} as const;

function ListingCard({ listing, onPress, wide }: { listing: Listing; onPress: () => void; wide: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${listing.title} details`} onPress={onPress} style={({ pressed }) => [styles.card, wide && styles.wideCard, pressed && styles.pressed]}>
      <View style={styles.cardImage}><ListingPhoto source={listing.imageUri} category={listing.category} label={listing.title} /></View>
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.cardTitle}>{listing.title}</Text>
        <Text numberOfLines={2} style={styles.cardDetails}>{listing.details}</Text>
        <Text numberOfLines={2} style={styles.cardAddress}>{formatListingAddress(listing)}</Text>
        <Text style={styles.price}>₱{listing.price.toLocaleString('en-PH')}{listing.priceUnit && listing.priceUnit !== 'per head' ? ` ${listing.priceUnit}` : ''}</Text>
      </View>
    </Pressable>
  );
}

type MarketplaceHomeScreenProps = {
  marketplace: MarketplaceService;
  routeFilters: SearchFilters;
  routeKey: string;
  isFocused: boolean;
  onOpenListing: (id: string) => void;
  onOpenNotifications: () => void;
  onSearch: (filters: SearchFilters) => void;
  onOpenFilters: (filters: SearchFilters) => void;
};

export function MarketplaceHomeScreen({
  marketplace,
  routeFilters,
  routeKey,
  isFocused,
  onOpenListing,
  onOpenNotifications,
  onSearch,
  onOpenFilters,
}: MarketplaceHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 360 || fontScale > 1.2 ? 1 : 2;
  const [verificationInfo, setVerificationInfo] = useState(false);
  const data = useSyncExternalStore(marketplace.subscribe, marketplace.getState, marketplace.getState);
  const notifications = useSyncExternalStore(notificationStore.subscribe, notificationStore.getSnapshot, notificationStore.getSnapshot);
  const [categoryDraft, setCategoryDraft] = useState<{ routeKey: string; value: LivestockCategory | null } | null>(null);
  const [queryDraft, setQueryDraft] = useState<{ routeKey: string; value: string } | null>(null);
  const category = categoryDraft?.routeKey === routeKey ? categoryDraft.value : routeFilters.category;
  const query = queryDraft?.routeKey === routeKey ? queryDraft.value : routeFilters.query;
  const filters = { ...routeFilters, category, query };
  const filtersActive = hasActiveFilterOptions(filters);

  const visibleListings = isFocused
    ? marketplace.findListings(toListingCriteria(filters)) : [];

  function openFilters() {
    onOpenFilters(filters);
  }

  const header = <>
        <View style={styles.locationRow}>
          <Icon name={icons.location} size={19} />
          <View style={styles.locationText}>
            <Text style={styles.locationCaption}>LOCATION</Text>
            <Text style={styles.locationName}>Davao del Norte</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={onOpenNotifications}
            style={styles.notificationButton}
          >
            <Icon name={icons.notification} size={20} color="#23352f" />
            {notifications.some((item) => item.unread) && <View style={styles.notificationDot} />}
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Icon name={icons.search} size={18} color="#8ea0b8" />
          <TextInput
            accessibilityLabel="Search livestock"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(value) => setQueryDraft({ routeKey, value })}
            onSubmitEditing={() => onSearch(filters)}
            placeholder="Search livestock..."
            placeholderTextColor="#52647a"
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {!!query && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => {
                setQueryDraft({ routeKey, value: '' });
                onSearch({ ...filters, query: '' });
              }}
              style={styles.clearSearchButton}
            >
              <NavigationIcon name="close" size={20} />
            </Pressable>
          )}
        </View>

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
            <Text style={styles.bannerTitle}>Buy from verified sellers</Text>
            <Text style={styles.bannerSubtitle}>Trade with confidence in your local area.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Learn more about verified sellers"
            onPress={() => setVerificationInfo(true)}
            style={styles.learnButton}
          >
            <Text style={styles.learnText}>Learn More</Text>
          </Pressable>
        </View>

        <View style={[styles.sectionHeading, styles.listingHeading]}>
          <Text style={styles.sectionTitle}>Fresh Listings</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={filtersActive ? 'Open filters, filters applied' : 'Open filters'}
            onPress={openFilters}
            style={[styles.filterButton, filtersActive && styles.filterButtonActive]}
          >
            <Icon name={icons.filter} size={18} />
            <Text style={styles.filterText}>Filter</Text>
          </Pressable>
        </View>

        <DataFeedback loading={data.loading} error={data.error} onRetry={marketplace.retry} />
      </>;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <StatusBar style="dark" />
      <FlatList
        key={columns}
        data={visibleListings}
        numColumns={columns}
        keyExtractor={(listing) => listing.id}
        renderScrollComponent={(props) => <KeyboardScrollView {...props} />}
        renderItem={({ item }) => <ListingCard listing={item} wide={columns === 1} onPress={() => onOpenListing(item.id)} />}
        columnWrapperStyle={columns === 2 ? styles.gridRow : undefined}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={styles.listHeader}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={!data.loading && !data.error ? <Text style={styles.emptyState}>{data.items.length ? 'No listings match your search or filters.' : 'No livestock listings yet. New listings will appear here.'}</Text> : null}
      />
      <MarketplaceBottomBar activeTab="home" bottomInset={insets.bottom} />
      <Modal visible={verificationInfo} transparent animationType="fade" onRequestClose={() => setVerificationInfo(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close seller information" onPress={() => setVerificationInfo(false)} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={styles.infoCard}>
            <ScrollView contentContainerStyle={styles.infoContent}>
            <Text accessibilityRole="header" style={styles.infoTitle}>Verified sellers</Text>
            <Text style={styles.infoText}>A verified seller has completed an identity check. Review the livestock details and documents, and agree on payment and transport before placing an order.</Text>
            <Pressable accessibilityRole="button" onPress={() => setVerificationInfo(false)} style={styles.infoButton}><Text style={styles.infoButtonText}>Got It</Text></Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
    paddingBottom: 24,
  },

  locationRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
  },
  locationCaption: {
    color: '#52647a',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.8,
  },
  locationName: {
    color: palette.green,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  notificationButton: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 22,
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
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dce4ed',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    ...platformShadow('#465c6d', 0.08, 7, 3, 2),
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
    paddingVertical: 10,
    color: palette.ink,
    fontSize: 16,
    lineHeight: 22,
  },
  clearSearchButton: {
    width: 44,
    height: 44,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
  },
  sectionTitle: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 160,
    minWidth: 0,
    color: palette.green,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
  },

  chipRow: {
    gap: 12,
    paddingTop: 11,
    paddingRight: 6,
    paddingBottom: 2,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    lineHeight: 18,
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
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    ...platformShadow('#183f31', 0.22, 9, 5, 5),
  },
  bannerCopy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 160,
    minWidth: 0,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    marginBottom: 3,
  },
  bannerSubtitle: {
    color: '#dceae3',
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 190,
  },
  learnButton: {
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnText: {
    color: palette.green,
    fontSize: 13, lineHeight: 18,
    fontWeight: '700',
  },

  listingHeading: {
    marginTop: 22,
  },
  filterButton: {
    minHeight: 44,
    maxWidth: '100%',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    borderColor: palette.green,
    backgroundColor: '#e9f4ec',
  },
  filterText: {
    color: palette.green,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },

  listHeader: { marginBottom: 12 },
  gridRow: { justifyContent: 'space-between' },
  separator: { height: 14 },
  wideCard: { width: '100%' },
  pressed: { opacity: 0.8 },
  card: {
    width: '48%',
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e7ef',
    ...platformShadow('#556a7d', 0.10, 6, 3, 2),
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
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  cardDetails: {
    color: '#52647a',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1,
  },
  cardAddress: { color: '#52647a', fontSize: 13, lineHeight: 18, marginTop: 4 },
  price: {
    color: palette.green,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    marginTop: 2,
  },
  emptyState: {
    color: palette.muted,
    textAlign: 'center',
    marginTop: 36,
    fontSize: 14,
    lineHeight: 21,
  },
  modalBackdrop: { flex: 1, backgroundColor: '#12372a70', justifyContent: 'center', alignItems: 'center', padding: 24 },
  infoCard: { width: '100%', maxWidth: 380, maxHeight: '85%', borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden' },
  infoContent: { gap: 16, padding: 20 },
  infoTitle: { color: palette.green, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  infoText: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  infoButton: { minHeight: 48, padding: 12, borderRadius: 12, backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center' },
  infoButtonText: { color: '#fff', fontSize: 15, lineHeight: 21, fontWeight: '700' },
});
