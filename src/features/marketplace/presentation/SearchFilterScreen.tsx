import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LivestockCategory } from '../domain/listing';
import {
  emptyFilters,
  featuredFilters,
  numericPrice,
  parseSearchFilters,
  serializeSearchFilters,
  type SearchFilters,
  type SortOrder,
} from '../domain/searchFilters';

const green = '#183d31';
const border = '#dce5f2';
const ink = '#253242';

const categories: { label: string; value: LivestockCategory }[] = [
  { label: 'Cow', value: 'Cow' },
  { label: 'Goats', value: 'Goat' },
  { label: 'Pig', value: 'Pig' },
  { label: 'Poultry', value: 'Chicken' },
];

const locations = ['', 'Tagum City, Davao del Norte'];
const sortOptions: { label: string; value: SortOrder }[] = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
];

function Preference({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: value }}
      onPress={onChange}
      style={styles.preference}
    >
      <View style={styles.preferenceCopy}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

export function SearchFilterScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const incoming = parseSearchFilters(params);
    return params.applied === 'true' ? incoming : {
      ...featuredFilters,
      query: incoming.query,
      category: incoming.category ?? featuredFilters.category,
      verifiedOnly: params.verifiedOnly === undefined ? featuredFilters.verifiedOnly : incoming.verifiedOnly,
    };
  });
  const [openMenu, setOpenMenu] = useState<'location' | 'sort' | null>(null);

  function update<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    const minPrice = numericPrice(filters.minPrice);
    const maxPrice = numericPrice(filters.maxPrice);
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return;
    }
    router.navigate({ pathname: '/home', params: serializeSearchFilters(filters) });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Search &amp; Filter</Text>
        <Pressable accessibilityRole="button" onPress={() => { setFilters(emptyFilters); setOpenMenu(null); }} style={styles.resetButton}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchField}>
          <TextInput
            accessibilityLabel="Search listings"
            autoCapitalize="none"
            onChangeText={(value) => update('query', value)}
            returnKeyType="search"
            style={styles.searchInput}
            value={filters.query}
          />
          {filters.query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => update('query', '')} hitSlop={12}>
              <Text style={styles.clearIcon}>×</Text>
            </Pressable>
          ) : <Text style={styles.clearIcon}>×</Text>}
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
          {categories.map((item) => {
            const selected = filters.category === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => update('category', selected ? null : item.value)}
                style={[styles.categoryChip, selected && styles.categoryChipSelected]}
              >
                <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Location</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Location"
          accessibilityState={{ expanded: openMenu === 'location' }}
          onPress={() => setOpenMenu(openMenu === 'location' ? null : 'location')}
          style={styles.selectField}
        >
          <Text numberOfLines={1} style={styles.selectText}>{filters.location || 'All Locations'}</Text>
          <Text style={styles.chevron}>⌄</Text>
        </Pressable>
        {openMenu === 'location' && (
          <View style={styles.menu}>
            {locations.map((location) => (
              <Pressable key={location} onPress={() => { update('location', location); setOpenMenu(null); }} style={styles.menuItem}>
                <Text style={styles.menuText}>{location || 'All Locations'}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>Price Range (₱)</Text>
        <View style={styles.priceRow}>
          <TextInput
            accessibilityLabel="Minimum price"
            keyboardType="numeric"
            onChangeText={(value) => update('minPrice', value.replace(/[^0-9]/g, ''))}
            placeholder="Min"
            placeholderTextColor="#8a99aa"
            style={styles.priceInput}
            value={filters.minPrice}
          />
          <TextInput
            accessibilityLabel="Maximum price"
            keyboardType="numeric"
            onChangeText={(value) => update('maxPrice', value.replace(/[^0-9]/g, ''))}
            placeholder="Max"
            placeholderTextColor="#8a99aa"
            style={styles.priceInput}
            value={filters.maxPrice}
          />
        </View>
        {numericPrice(filters.minPrice) !== undefined && numericPrice(filters.maxPrice) !== undefined
          && Number(filters.minPrice) > Number(filters.maxPrice) && (
          <Text style={styles.error}>Minimum price must be at most the maximum price.</Text>
        )}

        <Text style={styles.label}>Sort By</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sort by"
          accessibilityState={{ expanded: openMenu === 'sort' }}
          onPress={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
          style={styles.selectField}
        >
          <Text style={styles.selectText}>{sortOptions.find((item) => item.value === filters.sort)?.label}</Text>
          <Text style={styles.chevron}>⌄</Text>
        </Pressable>
        {openMenu === 'sort' && (
          <View style={styles.menu}>
            {sortOptions.map((option) => (
              <Pressable key={option.value} onPress={() => { update('sort', option.value); setOpenMenu(null); }} style={styles.menuItem}>
                <Text style={styles.menuText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={[styles.label, styles.preferencesLabel]}>Preferences</Text>
        <Preference
          title="Verified Raisers Only"
          description="Limit to listings from verified sellers"
          value={filters.verifiedOnly}
          onChange={() => update('verifiedOnly', !filters.verifiedOnly)}
        />
        <Preference
          title="Vaccinated Only"
          description="Filter by reported health documentation"
          value={filters.vaccinatedOnly}
          onChange={() => update('vaccinatedOnly', !filters.vaccinatedOnly)}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable accessibilityRole="button" onPress={applyFilters} style={styles.applyButton}>
          <Text style={styles.applyText}>Apply Filters &amp; Show Results</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { borderBottomWidth: 1, borderBottomColor: '#e5ebf1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28 },
  backButton: { width: 32, height: 36, justifyContent: 'center' },
  backIcon: { color: green, fontSize: 30, lineHeight: 32, marginTop: -4 },
  headerTitle: { color: green, fontSize: 16, fontWeight: '800' },
  resetButton: { minWidth: 42, height: 36, alignItems: 'flex-end', justifyContent: 'center' },
  resetText: { color: '#26664f', fontSize: 12, fontWeight: '700' },
  content: { paddingHorizontal: 28, paddingTop: 18, paddingBottom: 22 },
  searchField: { height: 40, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: border, backgroundColor: '#fafcff', paddingHorizontal: 13 },
  searchInput: { flex: 1, height: '100%', paddingVertical: 0, color: ink, fontSize: 14 },
  clearIcon: { color: '#8ca0b8', fontSize: 19, fontWeight: '300', lineHeight: 22 },
  label: { color: '#27313c', fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 19, marginBottom: 10 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { minHeight: 32, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: border, backgroundColor: '#fafcff', alignItems: 'center', justifyContent: 'center' },
  categoryChipSelected: { backgroundColor: green, borderColor: green },
  categoryText: { color: '#344258', fontSize: 12, fontWeight: '500' },
  categoryTextSelected: { color: '#fff', fontWeight: '700' },
  selectField: { height: 40, borderWidth: 1, borderColor: border, borderRadius: 11, backgroundColor: '#fafcff', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
  selectText: { flex: 1, color: '#354258', fontSize: 13 },
  chevron: { color: '#61748f', fontSize: 20, lineHeight: 22, marginTop: -6 },
  menu: { borderWidth: 1, borderColor: border, borderRadius: 10, backgroundColor: '#fff', marginTop: 5, overflow: 'hidden' },
  menuItem: { minHeight: 39, paddingHorizontal: 13, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border },
  menuText: { color: ink, fontSize: 13 },
  priceRow: { flexDirection: 'row', gap: 12 },
  priceInput: { flex: 1, height: 40, borderWidth: 1, borderColor: border, borderRadius: 11, backgroundColor: '#fafcff', paddingHorizontal: 13, color: ink, fontSize: 13 },
  error: { color: '#b42318', fontSize: 11, marginTop: 5 },
  preferencesLabel: { marginTop: 22, marginBottom: 8 },
  preference: { minHeight: 51, borderBottomWidth: 1, borderBottomColor: '#edf1f5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  preferenceCopy: { flex: 1 },
  preferenceTitle: { color: '#27313c', fontSize: 12, fontWeight: '800' },
  preferenceDescription: { color: '#77879c', fontSize: 11, marginTop: 2 },
  switchTrack: { width: 40, height: 22, borderRadius: 12, backgroundColor: '#b8c4cf', padding: 2, justifyContent: 'center' },
  switchTrackOn: { backgroundColor: green },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  switchThumbOn: { alignSelf: 'flex-end' },
  footer: { minHeight: 68, paddingTop: 10, paddingHorizontal: 28, backgroundColor: '#fff' },
  applyButton: { minHeight: 44, alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 16, backgroundColor: green, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
