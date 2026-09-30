import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OrderRequest } from '../domain/checkout';
import { filterOrders, type OrderFilter } from '../domain/order_list';
import { orderStatusCopy } from '../domain/order_status';
import { CheckoutButton, checkoutColors as color, checkoutIcons as icons } from './checkout_controls';
import { OrderBadge, OrderCard, OrderItem } from './order_cards';
import { amountRange, OrderSummaryRow } from './order_components';
import { OrderPage } from './order_page';

const filters: { value: OrderFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'cancelled', label: 'Cancelled' },
];

export function MyOrdersScreen({ orders, onBack, onOpenOrder, onMarketplace }: {
  orders: readonly OrderRequest[]; onBack: () => void; onOpenOrder: (orderId: string) => void; onMarketplace: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [query, setQuery] = useState('');
  const visibleOrders = filterOrders(orders, filter, query);
  const activeCount = orders.filter((order) => order.status !== 'cancelled').length;
  const counts = { all: orders.length, active: activeCount, cancelled: orders.length - activeCount };
  const reset = () => { setQuery(''); setFilter('all'); };

  return <OrderPage title="My Orders" onBack={onBack}>
    <FlatList
      data={visibleOrders}
      keyExtractor={(order) => order.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}
      ListHeaderComponent={<>
        <Text style={styles.intro}>View your requests and follow their order status.</Text>
        <View style={styles.search}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} tintColor={color.muted} />
          <TextInput accessibilityLabel="Search orders by livestock, seller, or order number" placeholder="Search your orders" placeholderTextColor={color.muted} value={query} onChangeText={setQuery} returnKeyType="search" autoCorrect={false} style={styles.searchInput} />
          {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear order search" onPress={() => setQuery('')} style={styles.clear}><SymbolView name={icons.close} size={18} tintColor={color.muted} /></Pressable>}
        </View>
        <View accessibilityRole="tablist" style={styles.filters}>
          {filters.map((option) => <Pressable key={option.value} accessibilityRole="tab" accessibilityLabel={`${option.label} orders, ${counts[option.value]}`} accessibilityState={{ selected: filter === option.value }} onPress={() => setFilter(option.value)} style={({ pressed }) => [styles.filter, filter === option.value && styles.selectedFilter, pressed && styles.pressed]}>
            <Text style={[styles.filterText, filter === option.value && styles.selectedFilterText]}>{option.label} ({counts[option.value]})</Text>
          </Pressable>)}
        </View>
        {!!orders.length && <Text accessibilityLiveRegion="polite" style={styles.resultCount}>{visibleOrders.length} {visibleOrders.length === 1 ? 'order' : 'orders'}</Text>}
      </>}
      renderItem={({ item: order }) => {
        const { draft } = order;
        const cancelled = order.status === 'cancelled';
        const date = new Date(order.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
        return <OrderCard title={order.id} meta={`Placed ${date}`}>
          <View style={styles.badge}><OrderBadge label={orderStatusCopy(order).pill} pending={order.status === 'awaiting-seller'} cancelled={cancelled} /></View>
          <OrderItem item={draft.item} showBadges={false} />
          <OrderSummaryRow label={draft.fulfillment === 'delivery' ? 'Delivery estimate' : 'Pickup total'} value={amountRange(draft.totalMin, draft.totalMax)} total />
          <CheckoutButton label="View Order Status" secondary={cancelled} onPress={() => onOpenOrder(order.id)} />
        </OrderCard>;
      }}
      ListEmptyComponent={<View style={styles.empty}>
        <View style={styles.emptyIcon}><SymbolView name={{ ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' }} size={30} tintColor={color.green} /></View>
        <Text accessibilityRole="header" style={styles.emptyTitle}>{orders.length ? 'No matching orders' : 'No orders yet'}</Text>
        <Text style={styles.emptyCopy}>{orders.length ? 'Try a different search or select another status.' : 'Choose livestock from the marketplace. Your placed requests and status will appear here.'}</Text>
        <CheckoutButton label={orders.length ? 'Show All Orders' : 'Browse Marketplace'} onPress={orders.length ? reset : onMarketplace} />
      </View>}
      ListFooterComponent={orders.length ? <View style={styles.footer}><Text style={styles.sessionNote}>Demo requests stay in this running session. Seller updates and payments are not connected.</Text><CheckoutButton secondary label="Browse Marketplace" onPress={onMarketplace} /></View> : null}
    />
  </OrderPage>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingHorizontal: 16, flexGrow: 1 },
  intro: { color: color.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  search: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, borderRadius: 12, borderWidth: 1, borderColor: color.line, backgroundColor: '#f8fbf9' },
  searchInput: { flex: 1, minWidth: 0, color: color.text, fontSize: 14, lineHeight: 20, paddingVertical: 14, paddingRight: 12 },
  clear: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 16 },
  filter: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: color.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', maxWidth: '100%' },
  selectedFilter: { borderColor: color.green, backgroundColor: color.green },
  filterText: { color: color.muted, fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  selectedFilterText: { color: '#fff' },
  pressed: { opacity: 0.75 },
  resultCount: { color: color.muted, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  badge: { marginBottom: 14 },
  empty: { paddingVertical: 28, gap: 14 },
  emptyIcon: { width: 64, height: 64, borderRadius: 18, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: color.mint },
  emptyTitle: { color: color.green, fontSize: 20, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  emptyCopy: { color: color.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 6 },
  footer: { gap: 14, paddingTop: 2 },
  sessionNote: { color: color.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
