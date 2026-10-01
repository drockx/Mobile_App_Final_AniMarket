import { NavigationIcon } from '@/components/navigation_icon';
import { DataFeedback } from '@/components/data_feedback';
import { useMemo, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketplaceBottomBar } from '@/components/marketplace_bottom_bar';
import { animalIcons } from '@/constants/animal_icons';

import type { LocalMarket, MarketCategory, MarketPrice } from '../domain/market_reference';

const forest = '#12372a';
const ink = '#17221d';
const muted = '#52647a';
const border = '#dfe8e2';
const categories: { label: string; value: MarketCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Cow', value: 'cow' },
  { label: 'Pig', value: 'pig' },
  { label: 'Goat', value: 'goat' },
  { label: 'Chicken', value: 'poultry' },
];
const sortOptions = [
  { label: 'Sort: Name', shortLabel: 'Sort: Name', value: 'name' },
  { label: 'Highest median', shortLabel: 'High median', value: 'median' },
  { label: 'Largest change', shortLabel: 'Big change', value: 'change' },
] as const;
type SortValue = typeof sortOptions[number]['value'];
type ModalKind = 'history' | null;

const icons = {
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
} as const;

function peso(value: number) {
  return `₱${value.toLocaleString('en-PH')}`;
}

function PriceCard({ item, onHistory, onCalculator }: {
  item: MarketPrice;
  onHistory: () => void;
  onCalculator?: () => void;
}) {
  const trend = item.change > 0
    ? `↑ ${item.change.toFixed(1)}% vs 7-day avg`
    : item.change < 0
      ? `↓ ${Math.abs(item.change).toFixed(1)}% vs 7-day avg`
      : '→ Stable vs 7-day avg';

  return (
    <View style={styles.priceCard}>
      <View style={styles.cardTop}>
        <View style={styles.itemMain}>
          <View style={styles.itemIcon}><Text style={styles.animalIcon}>{animalIcons[item.category]}</Text></View>
          <View style={styles.itemCopy}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemBasis}>{item.unit}</Text>
          </View>
        </View>
        <View style={styles.priceBox}>
          <Text style={styles.priceRange}>{peso(item.min)}–{peso(item.max)}</Text>
          <Text style={styles.median}>Median {peso(item.median)}</Text>
        </View>
      </View>
      <View style={styles.cardDetails}>
        <Text style={[styles.trend, item.change > 0 ? styles.trendUp : item.change < 0 ? styles.trendDown : styles.trendStable]}>{trend}</Text>
        <Text style={styles.observations}>{item.observations} observations</Text>
      </View>
      <View style={styles.cardActions}>
        {onCalculator && (
          <Pressable accessibilityRole="button" accessibilityLabel={`Use ${item.name} in calculator`} onPress={onCalculator} style={[styles.cardButton, styles.calculatorButton]}>
            <Text style={styles.calculatorText}>Use in Calculator</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.name} price history`} onPress={onHistory} style={[styles.cardButton, styles.historyButton]}>
          <Text style={styles.historyText}>View History</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function MarketReferenceScreen({ markets, loading, error, onRetry, onOpenCalculator }: { markets: readonly LocalMarket[]; loading?: boolean; error?: string | null; onRetry?: () => void; onOpenCalculator?: (category: MarketCategory, city: string) => void }) {
  const insets = useSafeAreaInsets();
  const [marketId, setMarketId] = useState('');
  const [marketOpen, setMarketOpen] = useState(false);
  const [category, setCategory] = useState<MarketCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortValue>('name');
  const [sortOpen, setSortOpen] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [selectedPriceSeed, setSelectedPrice] = useState<MarketPrice | null>(null);
  const market = markets.find((entry) => entry.id === marketId) ?? markets[0];
  const selectedPrice = market?.prices.find((item) => item.id === selectedPriceSeed?.id) ?? null;

  const prices = useMemo(() => {
    const search = query.trim().toLowerCase();
    const matching = (market?.prices ?? []).filter((item) =>
      (category === 'all' || item.category === category)
      && (!search || `${item.name} ${item.unit}`.toLowerCase().includes(search)),
    );
    return [...matching].sort((a, b) => {
      if (sort === 'median') return b.median - a.median;
      if (sort === 'change') return Math.abs(b.change) - Math.abs(a.change);
      return a.name.localeCompare(b.name);
    });
  }, [market, category, query, sort]);

  function openPriceModal(item: MarketPrice) {
    setSelectedPrice(item);
    setModal('history');
  }

  if (!market) return <View style={styles.screen}>
    <StatusBar style="dark" />
    <View style={[styles.header, { paddingTop: insets.top + 9 }]}><Text style={styles.headerTitle}>Market Reference</Text></View>
    <View style={{ flex: 1, padding: 20 }}><DataFeedback loading={loading} error={error} onRetry={onRetry} />
      {!loading && !error && <Text style={styles.emptyState}>No market prices are available yet. You can set a listing price manually.</Text>}
    </View><MarketplaceBottomBar activeTab="market" bottomInset={insets.bottom} />
  </View>;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 9 }]}>
        <Text style={styles.headerTitle}>Market Reference</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <DataFeedback loading={loading} error={error} onRetry={onRetry} />
        <View style={styles.regionCard}>
          <Text style={styles.eyebrow}>DAVAO DEL NORTE MARKET</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Choose market, currently ${market.name}`}
            accessibilityState={{ expanded: marketOpen }}
            onPress={() => { setMarketOpen(!marketOpen); setSortOpen(false); }}
            style={styles.marketSelect}
          >
            <Text style={styles.marketSelectText}>{market.name}</Text>
            <NavigationIcon name={marketOpen ? 'up' : 'down'} />
          </Pressable>
          {marketOpen && (
            <View style={styles.marketMenu}>
              {markets.map((entry) => (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: marketId === entry.id }}
                  onPress={() => { setMarketId(entry.id); setMarketOpen(false); }}
                  style={[styles.marketOption, marketId === entry.id && styles.marketOptionSelected]}
                >
                  <View style={styles.marketOptionCopy}>
                    <Text style={styles.marketOptionName}>{entry.name}</Text>
                    <Text style={styles.marketOptionLocation}>{entry.location}</Text>
                  </View>
                  {marketId === entry.id && <Text style={styles.marketOptionCheck}>✓</Text>}
                </Pressable>
              ))}
            </View>
          )}
          <Text style={styles.marketMeta}>{market.location} • {market.sample ? 'Sample reference' : market.source ?? 'Market reference'}</Text>
          <Text style={styles.marketMeta}>{market.sample ? 'Sample prices; confirm with the seller before trading.' : market.updatedAt ? `Updated ${new Date(market.updatedAt).toLocaleDateString()}` : 'Confirm current prices before trading.'}</Text>
        </View>

        <View style={styles.toolsRow}>
          <View style={styles.searchField}>
            <SymbolView name={icons.search} size={18} tintColor={muted} />
            <TextInput accessibilityLabel="Search livestock references" value={query} onChangeText={setQuery} placeholder="Search livestock" placeholderTextColor={muted} style={styles.searchInput} returnKeyType="search" />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Sort references, ${sortOptions.find((option) => option.value === sort)?.label}`} accessibilityState={{ expanded: sortOpen }} onPress={() => { setSortOpen(!sortOpen); setMarketOpen(false); }} style={styles.sortButton}>
            <Text numberOfLines={1} style={styles.sortText}>{sortOptions.find((option) => option.value === sort)?.shortLabel}</Text>
            <NavigationIcon name={sortOpen ? 'up' : 'down'} />
          </Pressable>
        </View>
        {sortOpen && (
          <View style={styles.sortMenu}>
            {sortOptions.map((option) => (
              <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: sort === option.value }} onPress={() => { setSort(option.value); setSortOpen(false); }} style={styles.sortOption}>
                <Text style={[styles.sortOptionText, sort === option.value && styles.sortOptionSelected]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.categoryRow}>
          {categories.map((option) => (
            <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: category === option.value }} onPress={() => setCategory(option.value)} style={[styles.categoryButton, category === option.value && styles.categorySelected]}>
              <Text style={[styles.categoryText, category === option.value && styles.categoryTextSelected]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>{prices.length} market {prices.length === 1 ? 'reference' : 'references'}</Text>
          <Text style={[styles.summaryText, styles.summaryHint]}>Range • Median • 7-day change</Text>
        </View>
        {prices.length ? prices.map((item) => (
          <PriceCard key={item.id} item={item} onCalculator={onOpenCalculator ? () => onOpenCalculator(item.category, market.location.split(',')[0]) : undefined} onHistory={() => openPriceModal(item)} />
        )) : <Text style={styles.emptyState}>No market references match this search and category.</Text>}

      </ScrollView>

      <MarketplaceBottomBar activeTab="market" bottomInset={insets.bottom} />

      <Modal visible={modal !== null} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={() => setModal(null)} style={StyleSheet.absoluteFill} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{selectedPrice?.name ?? ''} Price History</Text>
            <Text style={styles.modalSubtitle}>{market.name} • {selectedPrice?.unit ?? ''}</Text>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {selectedPrice && (
                <View style={styles.chart}>
                  {selectedPrice.history.map((value, index) => {
                    const low = Math.min(...selectedPrice.history);
                    const high = Math.max(...selectedPrice.history);
                    const barHeight = 32 + (high === low ? 0 : ((value - low) / (high - low)) * 70);
                    return (
                      <View key={index} style={styles.chartColumn}>
                        <Text style={styles.chartValue}>{peso(value)}</Text>
                        <View style={styles.chartTrack}><View style={[styles.chartBar, { height: barHeight }]} /></View>
                        <Text style={styles.chartDay}>D{index + 1}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setModal(null)} style={styles.closeButton}><Text style={styles.closeText}>Close</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#f8faf9' },
  header: { paddingHorizontal: 15, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#edf2f0' },
  headerTitle: { color: forest, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  content: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 22 },
  regionCard: { padding: 14, borderWidth: 1, borderColor: border, borderRadius: 15, backgroundColor: '#fff' },
  eyebrow: { color: muted, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.35, marginBottom: 7 },
  marketSelect: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#cbd5d0', borderRadius: 10, backgroundColor: '#f8faf9', flexDirection: 'row', alignItems: 'center', gap: 8 },
  marketSelectText: { flex: 1, minWidth: 0, color: forest, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  marketMenu: { marginTop: 4, borderWidth: 1, borderColor: border, borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden' },
  marketOption: { minHeight: 52, paddingHorizontal: 12, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border, flexDirection: 'row', alignItems: 'center', gap: 8 },
  marketOptionSelected: { backgroundColor: '#eaf5ed' },
  marketOptionCopy: { flex: 1, minWidth: 0 },
  marketOptionName: { color: forest, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  marketOptionLocation: { color: muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  marketOptionCheck: { color: forest, fontSize: 18, lineHeight: 22, fontWeight: '800' },
  marketMeta: { color: '#53675b', fontSize: 13, lineHeight: 18, marginTop: 5 },
  toolsRow: { marginTop: 13, flexDirection: 'row', gap: 8 },
  searchField: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 11, borderWidth: 1, borderColor: border, borderRadius: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  searchInput: { flex: 1, minHeight: 42, marginLeft: 7, paddingVertical: 0, color: ink, fontSize: 14 },
  sortButton: { width: 116, minHeight: 44, paddingHorizontal: 9, borderWidth: 1, borderColor: border, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff' },
  sortText: { flex: 1, minWidth: 0, color: forest, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  sortMenu: { alignSelf: 'flex-end', width: 175, marginTop: 4, borderWidth: 1, borderColor: border, borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden' },
  sortOption: { minHeight: 42, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border },
  sortOptionText: { color: ink, fontSize: 13, lineHeight: 18 },
  sortOptionSelected: { color: forest, fontWeight: '800' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, marginBottom: 10 },
  categoryButton: { minHeight: 33, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: border, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  categorySelected: { backgroundColor: forest, borderColor: forest },
  categoryText: { color: muted, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  categoryTextSelected: { color: '#fff' },
  summaryRow: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  summaryText: { color: muted, fontSize: 12, lineHeight: 16 },
  summaryHint: { flexShrink: 1, textAlign: 'right' },
  priceCard: { marginBottom: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8e4', borderRadius: 14, backgroundColor: '#fff' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  itemIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#e6f3e9', alignItems: 'center', justifyContent: 'center' },
  animalIcon: { fontSize: 19, lineHeight: 24 },
  itemCopy: { flex: 1, minWidth: 0 },
  itemName: { color: ink, fontSize: 15, lineHeight: 19, fontWeight: '800' },
  itemBasis: { color: muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  priceRange: { color: forest, fontSize: 16, lineHeight: 20, fontWeight: '800', textAlign: 'right' },
  median: { color: '#53675b', fontSize: 13, lineHeight: 18, marginTop: 2 },
  cardDetails: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#edf2f0', flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  trend: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  trendUp: { color: '#15803d' },
  trendDown: { color: '#b42318' },
  trendStable: { color: muted },
  observations: { color: muted, fontSize: 13, lineHeight: 18, textAlign: 'right' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cardButton: { flex: 1, minHeight: 42, paddingHorizontal: 5, paddingVertical: 6, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  calculatorButton: { backgroundColor: forest },
  historyButton: { borderWidth: 1, borderColor: forest, backgroundColor: '#fff' },
  calculatorText: { color: '#fff', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  historyText: { color: forest, fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  emptyState: { padding: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: '#cbd5d0', borderRadius: 13, backgroundColor: '#fff', color: muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  modalRoot: { flex: 1, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,34,25,0.62)' },
  modalSheet: { width: '100%', maxWidth: 420, maxHeight: '82%', padding: 17, borderRadius: 16, backgroundColor: '#fff' },
  modalTitle: { color: forest, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  modalSubtitle: { color: muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  modalScroll: { flexGrow: 0, marginTop: 12 },
  chart: { minHeight: 160, padding: 10, borderRadius: 12, backgroundColor: '#f5f9f6', flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  chartColumn: { flex: 1, minWidth: 0, alignItems: 'center' },
  chartValue: { color: muted, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  chartTrack: { height: 108, width: '100%', justifyContent: 'flex-end', paddingHorizontal: 2 },
  chartBar: { width: '100%', borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: '#4b8b69' },
  chartDay: { color: muted, fontSize: 12, lineHeight: 16, marginTop: 3 },
  closeButton: { minHeight: 44, marginTop: 13, borderRadius: 10, backgroundColor: forest, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '700' },
});
