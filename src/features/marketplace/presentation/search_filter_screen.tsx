import { KeyboardScrollView } from '@/components/keyboard_scroll_view';
import { AppTextInput as TextInput } from '@/components/app_text_input';
import { NavigationIcon } from '@/components/navigation_icon';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAVAO_DEL_NORTE, DAVAO_DEL_NORTE_LOCALITIES, davaoDelNorteLocalityLabel, davaoDelNorteLocation } from '@/constants/davao_del_norte';

import type { LivestockCategory } from '../domain/listing';
import {
  resetFilterOptions,
  numericPrice,
  type SearchFilters,
  type SortOrder,
} from './search_filters';

const green = '#183d31';
const border = '#dbe5de';
const ink = '#25332c';
const secondary = '#52645a';

const categories: { label: string; value: LivestockCategory }[] = [
  { label: 'Cow', value: 'Cow' },
  { label: 'Pig', value: 'Pig' },
  { label: 'Goat', value: 'Goat' },
  { label: 'Chicken', value: 'Chicken' },
];

const locations = [
  { label: 'All Davao del Norte', value: '' },
  ...DAVAO_DEL_NORTE_LOCALITIES.map((locality) => ({
    label: `${davaoDelNorteLocalityLabel(locality)}, ${DAVAO_DEL_NORTE}`,
    value: davaoDelNorteLocation(locality),
  })),
];
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

type SearchFilterScreenProps = {
  initialFilters: SearchFilters;
  onBack: () => void;
  onApply: (filters: SearchFilters) => void;
};

export function SearchFilterScreen({ initialFilters, onBack, onApply }: SearchFilterScreenProps) {
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [openMenu, setOpenMenu] = useState<'location' | 'sort' | null>(null);
  const minimum = numericPrice(filters.minPrice);
  const maximum = numericPrice(filters.maxPrice);
  const invalidRange = minimum !== undefined && maximum !== undefined && minimum > maximum;

  function update<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    const minPrice = numericPrice(filters.minPrice);
    const maxPrice = numericPrice(filters.maxPrice);
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return;
    }
    onApply(filters);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}
    >
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 8, minHeight: insets.top + 64 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.backButton}>
          <NavigationIcon name="back" />
        </Pressable>
        <Text style={styles.headerTitle}>Filters</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Reset filters" onPress={() => { setFilters(resetFilterOptions(filters)); setOpenMenu(null); }} style={styles.resetButton}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <KeyboardScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!!filters.query.trim() && (
          <View style={styles.searchContext}>
            <Text style={styles.searchContextLabel}>Filtering results for</Text>
            <Text style={styles.searchContextQuery}>{filters.query}</Text>
          </View>
        )}

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
          <Text style={styles.selectText}>{locations.find((item) => item.value === filters.location)?.label ?? locations[0].label}</Text>
          <NavigationIcon name={openMenu === 'location' ? 'up' : 'down'} />
        </Pressable>
        {openMenu === 'location' && (
          <View style={styles.menu}>
            {locations.map((location) => (
              <Pressable key={location.value} accessibilityRole="radio" accessibilityState={{ checked: filters.location === location.value }} onPress={() => { update('location', location.value); setOpenMenu(null); }} style={styles.menuItem}>
                <Text style={styles.menuText}>{location.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>Price Range (₱)</Text>
        <View style={styles.priceRow}>
          <View style={styles.priceField}>
            <Text style={styles.priceLabel}>Minimum</Text>
            <TextInput
              accessibilityLabel="Minimum price"
              keyboardType="numeric"
              maxLength={12}
              onChangeText={(value) => update('minPrice', value.replace(/[^0-9]/g, ''))}
              placeholder="Any"
              placeholderTextColor={secondary}
              style={styles.priceInput}
              value={filters.minPrice}
            />
          </View>
          <View style={styles.priceField}>
            <Text style={styles.priceLabel}>Maximum</Text>
            <TextInput
              accessibilityLabel="Maximum price"
              keyboardType="numeric"
              maxLength={12}
              onChangeText={(value) => update('maxPrice', value.replace(/[^0-9]/g, ''))}
              placeholder="Any"
              placeholderTextColor={secondary}
              style={styles.priceInput}
              value={filters.maxPrice}
            />
          </View>
        </View>
        {numericPrice(filters.minPrice) !== undefined && numericPrice(filters.maxPrice) !== undefined
          && Number(filters.minPrice) > Number(filters.maxPrice) && (
          <Text accessibilityRole="alert" style={styles.error}>Minimum price must be at most the maximum price.</Text>
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
          <NavigationIcon name={openMenu === 'sort' ? 'up' : 'down'} />
        </Pressable>
        {openMenu === 'sort' && (
          <View style={styles.menu}>
            {sortOptions.map((option) => (
              <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: filters.sort === option.value }} onPress={() => { update('sort', option.value); setOpenMenu(null); }} style={styles.menuItem}>
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
      </KeyboardScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: invalidRange }} disabled={invalidRange} onPress={applyFilters} style={[styles.applyButton, invalidRange && { opacity: 0.5 }]}>
          <Text style={styles.applyText}>Apply Filters</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { borderBottomWidth: 1, borderBottomColor: border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, minWidth: 0, textAlign: 'center', color: green, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  resetButton: { minWidth: 48, minHeight: 44, paddingVertical: 10, alignItems: 'flex-end', justifyContent: 'center' },
  resetText: { color: green, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  searchContext: { borderRadius: 12, backgroundColor: '#eef6f0', padding: 14, gap: 4 },
  searchContextLabel: { color: secondary, fontSize: 14, lineHeight: 20 },
  searchContextQuery: { color: green, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  label: { color: ink, fontSize: 16, lineHeight: 22, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { minHeight: 44, maxWidth: '100%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: border, backgroundColor: '#f8fbf9', alignItems: 'center', justifyContent: 'center' },
  categoryChipSelected: { backgroundColor: green, borderColor: green },
  categoryText: { color: ink, fontSize: 15, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  categoryTextSelected: { color: '#fff', fontWeight: '700' },
  selectField: { minHeight: 50, paddingVertical: 12, gap: 12, borderWidth: 1, borderColor: border, borderRadius: 11, backgroundColor: '#f8fbf9', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  selectText: { flex: 1, minWidth: 0, color: ink, fontSize: 16, lineHeight: 22 },
  menu: { borderWidth: 1, borderColor: border, borderRadius: 10, backgroundColor: '#fff', marginTop: 5, overflow: 'hidden' },
  menuItem: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border },
  menuText: { color: ink, fontSize: 16, lineHeight: 22 },
  priceRow: { flexDirection: 'row', gap: 12 },
  priceField: { flex: 1, minWidth: 0 },
  priceLabel: { color: secondary, fontSize: 14, lineHeight: 20, fontWeight: '600', marginBottom: 6 },
  priceInput: { minHeight: 50, width: '100%', borderWidth: 1, borderColor: border, borderRadius: 11, backgroundColor: '#f8fbf9', paddingHorizontal: 12, paddingVertical: 12, color: ink, fontSize: 16, lineHeight: 22 },
  error: { color: '#b42318', fontSize: 14, lineHeight: 20, marginTop: 5 },
  preferencesLabel: { marginTop: 22, marginBottom: 8 },
  preference: { minHeight: 76, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  preferenceCopy: { flex: 1, minWidth: 0 },
  preferenceTitle: { color: ink, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  preferenceDescription: { color: secondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  switchTrack: { width: 40, height: 22, flexShrink: 0, borderRadius: 12, backgroundColor: '#b8c4cf', padding: 2, justifyContent: 'center' },
  switchTrackOn: { backgroundColor: green },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  switchThumbOn: { alignSelf: 'flex-end' },
  footer: { paddingTop: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: border, backgroundColor: '#fff' },
  applyButton: { minHeight: 52, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: green, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#fff', fontSize: 16, lineHeight: 22, textAlign: 'center', fontWeight: '700' },
});
