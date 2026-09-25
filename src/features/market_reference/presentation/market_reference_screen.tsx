import { useMemo, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketplaceBottomBar } from '@/components/marketplace_bottom_bar';

import type { MarketCategory, MarketPrice, RegionalMarket } from '../domain/market_reference';

const forest = '#12372a';
const ink = '#17221d';
const muted = '#52647a';
const border = '#dfe8e2';
const categories: { label: string; value: MarketCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Cow', value: 'cow' },
  { label: 'Goat', value: 'goat' },
  { label: 'Pig', value: 'pig' },
  { label: 'Poultry', value: 'poultry' },
];
const sortOptions = [
  { label: 'Sort: Name', shortLabel: 'Sort: Name', value: 'name' },
  { label: 'Highest median', shortLabel: 'High median', value: 'median' },
  { label: 'Largest change', shortLabel: 'Big change', value: 'change' },
] as const;
type SortValue = typeof sortOptions[number]['value'];
type ModalKind = 'history' | 'calculator' | null;

const icons = {
  down: { ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
} as const;
const animalIcons: Record<MarketCategory, string> = { cow: '🐄', goat: '🐐', pig: '🐖', poultry: '🐓' };

function peso(value: number) {
  return `₱${value.toLocaleString('en-PH')}`;
}

function PriceCard({ item, onHistory, onCalculator }: {
  item: MarketPrice;
  onHistory: () => void;
  onCalculator: () => void;
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
        <Pressable accessibilityRole="button" accessibilityLabel={`Use ${item.name} in calculator`} onPress={onCalculator} style={[styles.cardButton, styles.calculatorButton]}>
          <Text style={styles.calculatorText}>Use in Calculator</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.name} price history`} onPress={onHistory} style={[styles.cardButton, styles.historyButton]}>
          <Text style={styles.historyText}>View History</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function MarketReferenceScreen({ markets }: { markets: readonly RegionalMarket[] }) {
  const insets = useSafeAreaInsets();
  const [marketId, setMarketId] = useState('tagum');
  const [marketOpen, setMarketOpen] = useState(false);
  const [category, setCategory] = useState<MarketCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortValue>('name');
  const [sortOpen, setSortOpen] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [selectedPrice, setSelectedPrice] = useState<MarketPrice | null>(null);
  const [quantity, setQuantity] = useState('');
  const market = markets.find((entry) => entry.id === marketId) ?? markets[0];

  const prices = useMemo(() => {
    const search = query.trim().toLowerCase();
    const matching = market.prices.filter((item) =>
      (category === 'all' || item.category === category)
      && (!search || `${item.name} ${item.unit}`.toLowerCase().includes(search)),
    );
    return [...matching].sort((a, b) => {
      if (sort === 'median') return b.median - a.median;
      if (sort === 'change') return Math.abs(b.change) - Math.abs(a.change);
      return a.name.localeCompare(b.name);
    });
  }, [market, category, query, sort]);

  const isPerHead = selectedPrice?.unit.toLowerCase().includes('per head') ?? false;
  const enteredQuantity = Number(quantity);
  const estimate = selectedPrice && Number.isFinite(enteredQuantity) && enteredQuantity > 0
    ? { min: selectedPrice.min * enteredQuantity, median: selectedPrice.median * enteredQuantity, max: selectedPrice.max * enteredQuantity }
    : null;

  function openPriceModal(kind: 'history' | 'calculator', item: MarketPrice) {
    setSelectedPrice(item);
    setQuantity('');
    setModal(kind);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 9 }]}>
        <Text style={styles.headerTitle}>Market Reference</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.regionCard}>
          <Text style={styles.eyebrow}>SELECTED DAVAO REGION MARKET</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Choose market, currently ${market.name}`}
            accessibilityState={{ expanded: marketOpen }}
            onPress={() => { setMarketOpen(!marketOpen); setSortOpen(false); }}
            style={styles.marketSelect}
          >
            <Text style={styles.marketSelectText}>{market.name}</Text>
            <SymbolView name={icons.down} size={17} tintColor={forest} />
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
          <Text style={styles.marketMeta}>{market.location} • City-level reference</Text>
          <View style={styles.freshnessRow}>
            <View style={styles.freshnessDot} />
            <Text style={styles.freshness}>Current sample</Text>
            <Text style={styles.freshnessMeta}>• Sample time: {market.sampleTime}</Text>
          </View>
          <Text style={styles.marketMeta}>Source: {market.name} sample feed</Text>
        </View>

        <View style={styles.toolsRow}>
          <View style={styles.searchField}>
            <SymbolView name={icons.search} size={18} tintColor={muted} />
            <TextInput accessibilityLabel="Search livestock references" value={query} onChangeText={setQuery} placeholder="Search livestock" placeholderTextColor={muted} style={styles.searchInput} returnKeyType="search" />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Sort references, ${sortOptions.find((option) => option.value === sort)?.label}`} accessibilityState={{ expanded: sortOpen }} onPress={() => { setSortOpen(!sortOpen); setMarketOpen(false); }} style={styles.sortButton}>
            <Text numberOfLines={1} style={styles.sortText}>{sortOptions.find((option) => option.value === sort)?.shortLabel}</Text>
            <SymbolView name={icons.down} size={15} tintColor={forest} />
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
          <PriceCard key={item.id} item={item} onCalculator={() => openPriceModal('calculator', item)} onHistory={() => openPriceModal('history', item)} />
        )) : <Text style={styles.emptyState}>No market references match this search and category.</Text>}

      </ScrollView>

      <MarketplaceBottomBar activeTab="market" bottomInset={insets.bottom} />

      <Modal visible={modal !== null} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={() => setModal(null)} style={StyleSheet.absoluteFill} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{modal === 'history' ? `${selectedPrice?.name ?? ''} Price History` : 'Reference Calculator'}</Text>
            <Text style={styles.modalSubtitle}>{market.name} • {selectedPrice?.unit ?? ''}</Text>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {modal === 'history' && selectedPrice && (
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
              {modal === 'calculator' && selectedPrice && (
                <View style={styles.calculatorContent}>
                  <Text style={styles.calculatorHelp}>Enter {isPerHead ? 'number of heads' : 'live weight in kg'} to estimate a price from this sample range.</Text>
                  <TextInput accessibilityLabel={isPerHead ? 'Number of heads' : 'Live weight in kilograms'} keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} placeholder={isPerHead ? 'Number of heads' : 'Live weight (kg)'} placeholderTextColor={muted} style={styles.quantityInput} />
                  {estimate && (
                    <View style={styles.estimateBox}>
                      <Text style={styles.estimateLabel}>Estimated range</Text>
                      <Text style={styles.estimateValue}>{peso(estimate.min)}–{peso(estimate.max)}</Text>
                      <Text style={styles.estimateMedian}>At median: {peso(estimate.median)}</Text>
                    </View>
                  )}
                  <Text style={styles.calculatorNote}>Estimate only. Final selling prices may differ.</Text>
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
  marketSelectText: { flex: 1, color: forest, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  marketMenu: { marginTop: 4, borderWidth: 1, borderColor: border, borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden' },
  marketOption: { minHeight: 52, paddingHorizontal: 12, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border, flexDirection: 'row', alignItems: 'center', gap: 8 },
  marketOptionSelected: { backgroundColor: '#eaf5ed' },
  marketOptionCopy: { flex: 1, minWidth: 0 },
  marketOptionName: { color: forest, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  marketOptionLocation: { color: muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  marketOptionCheck: { color: forest, fontSize: 18, lineHeight: 22, fontWeight: '800' },
  marketMeta: { color: '#53675b', fontSize: 13, lineHeight: 18, marginTop: 5 },
  freshnessRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 4 },
  freshnessDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16a34a' },
  freshness: { color: '#166534', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  freshnessMeta: { color: '#53675b', fontSize: 13, lineHeight: 18 },
  toolsRow: { marginTop: 13, flexDirection: 'row', gap: 8 },
  searchField: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 11, borderWidth: 1, borderColor: border, borderRadius: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  searchInput: { flex: 1, minHeight: 42, marginLeft: 7, paddingVertical: 0, color: ink, fontSize: 14 },
  sortButton: { width: 116, minHeight: 44, paddingHorizontal: 9, borderWidth: 1, borderColor: border, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff' },
  sortText: { flex: 1, color: forest, fontSize: 13, lineHeight: 18, fontWeight: '700' },
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
  calculatorContent: { gap: 11, paddingVertical: 4 },
  calculatorHelp: { color: ink, fontSize: 14, lineHeight: 20 },
  quantityInput: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: '#cbd5d0', borderRadius: 10, color: ink, fontSize: 16 },
  estimateBox: { padding: 12, borderRadius: 10, backgroundColor: '#e6f3e9' },
  estimateLabel: { color: forest, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  estimateValue: { color: forest, fontSize: 20, lineHeight: 27, fontWeight: '800', marginTop: 2 },
  estimateMedian: { color: '#2d6a4f', fontSize: 14, lineHeight: 20 },
  calculatorNote: { color: muted, fontSize: 13, lineHeight: 19 },
  closeButton: { minHeight: 44, marginTop: 13, borderRadius: 10, backgroundColor: forest, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '700' },
});
