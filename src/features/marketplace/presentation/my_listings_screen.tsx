import { KeyboardScrollView } from '@/components/keyboard_scroll_view';
import { AppTextInput as TextInput } from '@/components/app_text_input';
import { NavigationIcon } from '@/components/navigation_icon';
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { DataFeedback } from '@/components/data_feedback';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { animalIcons } from '@/constants/animal_icons';
import { appFormStyles } from '@/constants/app_theme';

import type { SellerListingsService } from '../application/seller_listings_service';
import type { ListingStatus, SellerListing } from '../domain/seller_listing';

const color = { forest: '#12372a', green: '#2d6a4f', mint: '#eaf5ed', soft: '#f7faf8', line: '#dfe8e2', text: '#17221d', muted: '#52647a', amber: '#966300', amberBg: '#fff7df', amberLine: '#edddb1', blue: '#245e8a', blueBg: '#edf5fb' };
const listingAnimalIcons: Record<SellerListing['category'], string> = {
  Cow: animalIcons.cow, Goat: animalIcons.goat, Pig: animalIcons.pig, Chicken: animalIcons.poultry,
};
const icons = {
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  more: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  list: { ios: 'list.bullet.rectangle', android: 'list_alt', web: 'list_alt' },
} as const;
const statuses = ['all', 'active', 'draft', 'paused', 'sold'] as const;
const sorts = [{ value: 'recent', label: 'Newest' }, { value: 'inquiries', label: 'Most inquiries' }, { value: 'price', label: 'Highest price' }] as const;
type Sort = typeof sorts[number]['value'];
type Dialog = { kind: 'sort' } | { kind: 'price' | 'more' | 'delete' | 'preview' | 'order'; listing: SellerListing } | null;
const money = (value: number) => `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function Button({ label, onPress, secondary = false, destructive = false }: { label: string; onPress: () => void; secondary?: boolean; destructive?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, destructive && styles.destructiveButton, pressed && styles.pressed]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText, destructive && styles.destructiveText]}>{label}</Text>
  </Pressable>;
}

function Badge({ status }: { status: ListingStatus }) {
  const tint = status === 'active' ? color.green : status === 'draft' ? color.blue : status === 'paused' ? color.amber : color.muted;
  const backgroundColor = status === 'active' ? color.mint : status === 'draft' ? color.blueBg : status === 'paused' ? color.amberBg : '#eef1ef';
  return <View style={[styles.badge, { backgroundColor }]}><View style={[styles.dot, { backgroundColor: tint }]} /><Text style={[styles.badgeText, { color: tint }]}>{capitalize(status)}</Text></View>;
}

export function MyListingsScreen({ service, onBack, onCreate, onInquiries, onOrders }: {
  service: SellerListingsService;
  onBack: () => void;
  onCreate: (listing?: SellerListing, continueDraft?: boolean) => void;
  onInquiries: () => void;
  onOrders: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.25;
  const stackPrice = Math.min(width, 480) < 420 || fontScale > 1.15;
  const stackSearch = width < 400 || fontScale > 1.15;
  const listings = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const data = service.getState();
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<typeof statuses[number]>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const counts = useMemo(() => ({ all: listings.length, active: listings.filter((x) => x.status === 'active').length, draft: listings.filter((x) => x.status === 'draft').length, paused: listings.filter((x) => x.status === 'paused').length, sold: listings.filter((x) => x.status === 'sold').length }), [listings]);
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = listings.filter((x) => (filter === 'all' || x.status === filter) && `${x.title} ${x.id} ${x.location}`.toLowerCase().includes(q));
    if (sort === 'inquiries') result.sort((a, b) => b.inquiries - a.inquiries);
    if (sort === 'price') result.sort((a, b) => b.price - a.price);
    return result;
  }, [listings, query, filter, sort]);

  function editPrice(listing: SellerListing) {
    setPrice(String(listing.price)); setError(''); setDialog({ kind: 'price', listing });
  }
  async function mutate(action: () => Promise<unknown>, message: string) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { await action(); setDialog(null); setFeedback(message); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save your changes. Please retry.'); }
    finally { saving.current = false; setBusy(false); }
  }
  function savePrice() {
    if (dialog?.kind !== 'price') return;
    if (!price.trim() || !Number.isFinite(Number(price)) || Number(price) <= 0) {
      setError('Enter a valid price greater than zero.'); return;
    }
    const id = dialog.listing.id;
    void mutate(() => service.updatePrice(id, Number(price)), 'Listing price updated.');
  }
  function togglePaused(listing: SellerListing) {
    const paused = listing.status === 'active';
    void mutate(() => service.setPaused(listing.id, paused), paused ? 'Listing paused.' : 'Listing resumed.');
  }
  function secondary(listing: SellerListing) {
    if (listing.status === 'draft') setDialog({ kind: 'preview', listing });
    else if (listing.status === 'sold') onCreate(listing);
    else editPrice(listing);
  }
  function primary(listing: SellerListing) {
    if (listing.status === 'active') onInquiries();
    else if (listing.status === 'draft') onCreate(listing, true);
    else if (listing.status === 'paused') togglePaused(listing);
    else setDialog({ kind: 'order', listing });
  }

  const header = <View>
    <DataFeedback loading={data.loading || busy} error={error || data.error} onRetry={() => { setError(''); service.retry(); }} />
    <View style={styles.summary}>
      {[[String(counts.active + counts.paused), 'Published'], [String(listings.filter((x) => x.status === 'active').reduce((sum, x) => sum + x.inquiries, 0)), 'New inquiries'], [String(counts.draft), 'Draft']].map(([value, label], index) => <View key={label} style={[styles.summaryCard, index === 1 && styles.attentionCard]}>
        <Text style={[styles.summaryValue, index === 1 && styles.amberText]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text>
      </View>)}
    </View>
    <View style={[styles.searchRow, stackSearch && styles.searchRowCompact]}>
      <View style={[styles.search, stackSearch && styles.searchCompact]}>
        <SymbolView name={icons.search} size={17} tintColor={color.muted} />
        <TextInput accessibilityLabel="Search livestock or listing ID" value={query} onChangeText={setQuery} placeholder="Search livestock or ID" placeholderTextColor={color.muted} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.searchInput} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Sort listings: ${sorts.find((x) => x.value === sort)?.label}`} onPress={() => { Keyboard.dismiss(); setDialog({ kind: 'sort' }); }} style={[styles.sort, stackSearch && styles.sortCompact]}>
        <Text style={styles.sortText}>{sorts.find((x) => x.value === sort)?.label}</Text><NavigationIcon name={dialog?.kind === 'sort' ? 'up' : 'down'} />
      </Pressable>
    </View>
    <View style={styles.tabs}>
      {statuses.map((status) => <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected: filter === status }} onPress={() => setFilter(status)} style={[styles.tab, status === filter && styles.tabSelected]}>
        <Text style={[styles.tabText, status === filter && styles.tabSelectedText]}>{capitalize(status)} ({counts[status]})</Text>
      </Pressable>)}
    </View>
    {!!feedback && <View style={styles.feedback}><Text accessibilityLiveRegion="polite" style={styles.feedbackText}>{feedback}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss confirmation" onPress={() => setFeedback('')} style={styles.dismiss}><NavigationIcon name="close" /></Pressable></View>}
    <View style={styles.listHeading}><Text accessibilityRole="header" style={styles.listTitle}>{capitalize(filter)} Listings</Text><Text style={styles.resultCount}>{items.length} result{items.length === 1 ? '' : 's'}</Text></View>
  </View>;

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.background}>
    <StatusBar style="dark" />
    <View style={styles.screen}>
      <View style={[styles.header, compact && styles.headerStacked, { paddingTop: insets.top + 9 }]}>
        <View style={[styles.headerMain, compact && styles.headerMainStacked]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" onPress={onBack} style={styles.back}><NavigationIcon name="back" /></Pressable>
          <View style={styles.headerCopy}><Text accessibilityRole="header" style={styles.title}>My Listings</Text></View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => onCreate()} style={({ pressed }) => [styles.newButton, compact && styles.newButtonStacked, pressed && styles.pressed]}><Text style={styles.newText}>+ New Listing</Text></Pressable>
      </View>
      <FlatList
        renderScrollComponent={(props) => <KeyboardScrollView {...props} />}
        data={items} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<View style={styles.empty}><SymbolView name={icons.list} size={35} tintColor={color.green} /><Text style={styles.emptyTitle}>No listings found</Text><Text style={styles.emptyCopy}>Try another search or create a new livestock listing.</Text><Button label="Create Listing" onPress={() => onCreate()} /></View>}
        renderItem={({ item }) => <View style={styles.card}>
          <View style={styles.cardTop}>
            <View accessible accessibilityRole="image" accessibilityLabel={`${item.category} listing`} style={styles.thumbnail}>
              <Text allowFontScaling={false} style={styles.animalIcon}>{listingAnimalIcons[item.category]}</Text>
            </View>
            <View style={styles.cardCopy}>
              <Badge status={item.status} /><Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.listingId}>{item.id}</Text>
              <Text style={styles.meta}>{item.details}</Text>
              <Text style={styles.meta}>{item.location}</Text>
            </View>
            {!stackPrice && <View style={styles.priceBlock}><Text style={styles.price}>{money(item.price)}</Text><Text style={styles.unit}>{item.unit}</Text></View>}
          </View>
          {stackPrice && <View style={styles.compactPrice}><Text style={styles.price}>{money(item.price)}</Text><Text style={styles.unit}>{item.unit}</Text></View>}
          <View style={styles.metrics}>{[['Views', String(item.views)], ['Inquiries', String(item.inquiries)], ['Updated', item.updated]].map(([label, value]) => <View key={label} style={styles.metric}><Text style={styles.metricLabel}>{label.toUpperCase()}</Text><Text style={styles.metricValue}>{value}</Text></View>)}</View>
          <View style={styles.notice}><Text style={styles.noticeText}>{item.notice}</Text></View>
          <View style={[styles.actions, compact && styles.actionsCompact]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`More actions for ${item.title}`} onPress={() => setDialog({ kind: 'more', listing: item })} style={styles.more}><SymbolView name={icons.more} size={19} tintColor={color.forest} /></Pressable>
            <View style={styles.secondaryAction}><Button secondary label={item.status === 'draft' ? 'Preview' : item.status === 'sold' ? 'List Similar' : 'Edit Listing'} onPress={() => secondary(item)} /></View>
            <View style={[styles.primaryAction, compact && styles.primaryActionCompact]}><Button label={item.status === 'active' ? 'View Inquiries' : item.status === 'draft' ? 'Continue Draft' : item.status === 'paused' ? 'Resume Listing' : 'View Order'} onPress={() => primary(item)} /></View>
          </View>
        </View>}
      />
    </View>
    <Modal transparent visible={dialog !== null} animationType="fade" onRequestClose={() => { if (!busy) setDialog(null); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
        <Pressable accessibilityLabel="Close dialog" disabled={busy} onPress={() => setDialog(null)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.dialog}>
          <KeyboardScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialogContent} pointerEvents={busy ? 'none' : 'auto'}>
            <DataFeedback loading={busy} error={error} />
            {dialog?.kind === 'sort' && <><Text accessibilityRole="header" style={styles.dialogTitle}>Sort listings</Text>{sorts.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: sort === option.value }} onPress={() => { setSort(option.value); setDialog(null); }} style={styles.option}><Text style={[styles.optionText, sort === option.value && styles.selectedOption]}>{option.label}</Text>{sort === option.value && <Text style={styles.selectedOption}>✓</Text>}</Pressable>)}<Button secondary label="Cancel" onPress={() => setDialog(null)} /></>}
            {dialog?.kind === 'price' && <><Text accessibilityRole="header" style={styles.dialogTitle}>Update listing price</Text><Text style={styles.dialogCopy}>Update {dialog.listing.title}. The new price applies {dialog.listing.unit}.</Text><Text style={styles.inputLabel}>Price (₱)</Text><TextInput accessibilityLabel="Price in pesos" autoFocus value={price} onChangeText={(value) => { setPrice(value); setError(''); }} keyboardType="decimal-pad" onSubmitEditing={savePrice} style={styles.priceInput} />{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<View style={styles.dialogActions}><View style={styles.flex}><Button secondary label="Cancel" onPress={() => setDialog(null)} /></View><View style={styles.flex}><Button label="Save Price" onPress={savePrice} /></View></View></>}
            {dialog?.kind === 'more' && <><Text accessibilityRole="header" style={styles.dialogTitle}>Listing actions</Text><Text style={styles.dialogCopy}>{dialog.listing.title}</Text>{(dialog.listing.status === 'active' || dialog.listing.status === 'paused') && <Button secondary label={dialog.listing.status === 'active' ? 'Pause Listing' : 'Resume Listing'} onPress={() => togglePaused(dialog.listing)} />}<Button secondary label="List Similar" onPress={() => { const listing = dialog.listing; setDialog(null); onCreate(listing); }} /><Button secondary destructive label="Delete Listing" onPress={() => setDialog({ kind: 'delete', listing: dialog.listing })} /><Button secondary label="Cancel" onPress={() => setDialog(null)} /></>}
            {dialog?.kind === 'delete' && <><Text accessibilityRole="header" style={styles.dialogTitle}>Delete listing?</Text><Text style={styles.dialogCopy}>{dialog.listing.title} will be removed from My Listings. This cannot be undone during this session.</Text><Button destructive label="Delete Listing" onPress={() => { const id = dialog.listing.id; void mutate(() => service.remove(id), 'Listing deleted.'); }} /><Button secondary label="Cancel" onPress={() => setDialog(null)} /></>}
            {dialog?.kind === 'preview' && <><Text accessibilityRole="header" style={styles.dialogTitle}>{dialog.listing.title}</Text><Badge status={dialog.listing.status} /><Text style={styles.price}>{money(dialog.listing.price)} {dialog.listing.unit}</Text><Text style={styles.dialogCopy}>{dialog.listing.details}{'\n'}{dialog.listing.location}</Text><View style={styles.notice}><Text style={styles.noticeText}>{dialog.listing.notice}</Text></View><Button label="Continue Draft" onPress={() => { const listing = dialog.listing; setDialog(null); onCreate(listing, true); }} /><Button secondary label="Close" onPress={() => setDialog(null)} /></>}
            {dialog?.kind === 'order' && <><Text accessibilityRole="header" style={styles.dialogTitle}>Completed order</Text><Text style={styles.dialogCopy}>{dialog.listing.orderId}{'\n'}{dialog.listing.title}{'\n'}{money(dialog.listing.price)} {dialog.listing.unit}</Text><Text style={styles.dialogCopy}>View the order associated with this livestock in My Orders.</Text><Button label="My Orders" onPress={() => { setDialog(null); onOrders(); }} /><Button secondary label="Close" onPress={() => setDialog(null)} /></>}
          </KeyboardScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#e9f0eb' },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { paddingHorizontal: 13, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: color.line },
  headerStacked: { flexDirection: 'column', alignItems: 'stretch' },
  headerMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerMainStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  back: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  headerCopy: { flex: 1, minWidth: 0 }, title: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: color.forest },
  newButton: { minHeight: 44, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: color.forest, alignItems: 'center', justifyContent: 'center' }, newButtonStacked: { alignSelf: 'flex-end', maxWidth: '100%' }, newText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  content: { paddingHorizontal: 15, paddingTop: 13 }, summary: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: color.line, borderRadius: 12, padding: 10, backgroundColor: '#fff' }, attentionCard: { backgroundColor: color.amberBg, borderColor: color.amberLine },
  summaryValue: { fontSize: 20, lineHeight: 27, fontWeight: '700', color: color.forest }, amberText: { color: color.amber }, summaryLabel: { fontSize: 13, lineHeight: 18, color: color.muted, marginTop: 2 },
  searchRow: { flexDirection: 'row', gap: 8 }, searchRowCompact: { flexDirection: 'column' }, search: { flex: 1, minWidth: 0, minHeight: 52, borderWidth: 1, borderColor: color.line, borderRadius: 12, backgroundColor: '#fbfdfb', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  searchCompact: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  searchInput: { ...appFormStyles.value, flex: 1, minWidth: 0, minHeight: 50, color: color.text, paddingVertical: 12 }, sort: { ...appFormStyles.control, width: 136, borderColor: color.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, sortCompact: { width: '100%' }, sortText: { ...appFormStyles.value, flex: 1, minWidth: 0, color: color.forest },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 9, paddingBottom: 11 }, tab: { minHeight: 44, maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: color.line, borderRadius: 99, justifyContent: 'center' }, tabSelected: { backgroundColor: color.forest, borderColor: color.forest }, tabText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: color.muted }, tabSelectedText: { color: '#fff' },
  listHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }, listTitle: { fontSize: 15, lineHeight: 21, color: color.forest, fontWeight: '700' }, resultCount: { fontSize: 13, lineHeight: 18, color: color.muted }, separator: { height: 11 },
  card: { borderWidth: 1, borderColor: color.line, borderRadius: 16, padding: 12, backgroundColor: '#fff', shadowColor: color.forest, shadowOpacity: 0.04, shadowOffset: { width: 0, height: 3 }, shadowRadius: 12, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, thumbnail: { width: 58, height: 58, borderRadius: 12, backgroundColor: '#e6f3e9', alignItems: 'center', justifyContent: 'center' }, animalIcon: { fontSize: 28, lineHeight: 36 }, cardCopy: { flex: 1, minWidth: 0 }, cardTitle: { fontSize: 15, lineHeight: 21, fontWeight: '800', color: color.text, marginBottom: 4 }, listingId: { fontSize: 13, lineHeight: 18, color: color.muted, marginBottom: 2 }, meta: { fontSize: 13, lineHeight: 18, color: color.muted },
  badge: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 99, paddingVertical: 4, paddingHorizontal: 7, marginBottom: 7 }, dot: { width: 5, height: 5, borderRadius: 3 }, badgeText: { flexShrink: 1, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  priceBlock: { alignItems: 'flex-end', maxWidth: 108, flexShrink: 1 }, price: { fontSize: 16, lineHeight: 22, fontWeight: '800', color: color.forest }, unit: { fontSize: 13, lineHeight: 18, color: color.muted, marginTop: 2 }, compactPrice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6, marginTop: 10 },
  metrics: { flexDirection: 'row', gap: 7, marginVertical: 11 }, metric: { flex: 1, minWidth: 0, backgroundColor: color.soft, borderRadius: 9, padding: 8 }, metricLabel: { fontSize: 13, lineHeight: 18, color: color.muted }, metricValue: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: color.text, marginTop: 2 },
  notice: { borderWidth: 1, borderColor: color.amberLine, backgroundColor: color.amberBg, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 9, marginBottom: 10 }, noticeText: { fontSize: 13, lineHeight: 18, color: '#684500' },
  actions: { flexDirection: 'row', gap: 7 }, actionsCompact: { flexWrap: 'wrap' }, more: { width: 42, minHeight: 44, borderWidth: 1, borderColor: color.line, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, secondaryAction: { flex: 1 }, primaryAction: { flex: 1.25 }, primaryActionCompact: { flexBasis: '100%' },
  button: { minHeight: 44, borderRadius: 10, backgroundColor: color.forest, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 8 }, secondaryButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: color.forest }, buttonText: { color: '#fff', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' }, secondaryText: { color: color.forest }, pressed: { opacity: 0.75 }, destructiveButton: { backgroundColor: '#fff1ef', borderWidth: 1, borderColor: '#efc5bf' }, destructiveText: { color: '#a33b34' },
  empty: { alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#cbd7cf', borderRadius: 15, padding: 24, gap: 10 }, emptyTitle: { color: color.forest, fontWeight: '700', fontSize: 15, lineHeight: 21 }, emptyCopy: { color: color.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  feedback: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, marginBottom: 10, backgroundColor: color.mint, borderRadius: 9 }, feedbackText: { flex: 1, color: color.green, fontSize: 13, lineHeight: 18 }, dismiss: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: '#12372a70', justifyContent: 'center', alignItems: 'center', padding: 20 }, dialog: { width: '100%', maxWidth: 360, maxHeight: '85%', borderRadius: 17, backgroundColor: '#fff' }, dialogContent: { padding: 18, gap: 10 }, dialogTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: color.forest }, dialogCopy: { fontSize: 13, lineHeight: 18, color: color.muted }, dialogActions: { flexDirection: 'row', gap: 8, marginTop: 4 }, flex: { flex: 1 }, inputLabel: { ...appFormStyles.label, color: color.text }, priceInput: { ...appFormStyles.control, ...appFormStyles.value, borderColor: color.line, color: color.text }, error: { fontSize: 13, lineHeight: 18, color: '#a33b34' }, option: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: color.line }, optionText: { fontSize: 14, lineHeight: 19, color: color.text }, selectedOption: { fontWeight: '700', color: color.green },
});
