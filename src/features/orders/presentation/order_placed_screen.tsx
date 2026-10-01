import { LinearGradient } from 'expo-linear-gradient';
import { DataFeedback } from '@/components/data_feedback';
import { SymbolView } from 'expo-symbols';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OrderRequest } from '../domain/checkout';
import { CheckoutButton, checkoutColors as color, checkoutIcons as icons } from './checkout_controls';
import { OrderBadge, OrderCard, OrderConfirmation, OrderItem } from './order_cards';
import { amountRange, OrderNotice, OrderSteps, OrderSummaryRow, readableDate } from './order_components';
import { OrderPage } from './order_page';
import { orderStatusCopy } from '../domain/order_status';

export function OrderPlacedScreen({ order, loading, error, onRetry, onOrders, onStatus, onMarketplace }: {
  loading?: boolean; error?: string | null; onRetry?: () => void;
  order?: OrderRequest; onOrders: () => void; onStatus: () => void; onMarketplace: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!order || order.status === 'cancelled') return <OrderPage title="Order Placed" onBack={onOrders}>
    <ScrollView contentContainerStyle={[styles.missing, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      <DataFeedback loading={loading} error={error} onRetry={onRetry} />
      {!loading && !error && <><Text accessibilityRole="header" style={styles.missingTitle}>{order ? 'This order was cancelled' : 'Order unavailable'}</Text>
      <Text style={styles.body}>{order ? 'View the order status for its cancellation details.' : 'This order is not available for your account. You can view your other requests in My Orders.'}</Text></>}
      {order && <CheckoutButton label="View Order Status" onPress={onStatus} />}
      <CheckoutButton label="My Orders" secondary={!!order} onPress={onOrders} />
      <CheckoutButton secondary label="Browse Marketplace" onPress={onMarketplace} />
    </ScrollView>
  </OrderPage>;

  const { draft } = order;
  const { delivery, pickup, item } = draft;
  const local = order.status === 'saved-locally';
  return <OrderPage title="Order Placed" onBack={onOrders}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      <OrderSteps current={2} />
      <LinearGradient colors={['#12372a', '#2d6a4f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.check}><SymbolView name={icons.check} size={32} tintColor="#fff" /></View>
        <Text accessibilityRole="header" style={styles.heroTitle}>Your order request is placed</Text>
        <Text style={styles.heroCopy}>{local ? 'Your request is saved in My Orders for this session. The seller has not been notified yet.' : orderStatusCopy(order).description}</Text>
        <View style={styles.heroReference}><Text style={styles.referenceLabel}>Order number</Text><Text selectable style={styles.reference}>{order.id}</Text></View>
      </LinearGradient>

      <OrderCard title="Order details" meta={`Placed ${new Date(order.createdAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`}>
        <View style={styles.badge}><OrderBadge label={orderStatusCopy(order).pill} pending={order.status === 'awaiting-seller'} /></View>
        <OrderItem item={item} showBadges={false} />
        <View style={styles.details}>
          <OrderSummaryRow detail label="Arrangement" value={delivery ? 'Delivery requested' : 'Seller pickup'} />
          <OrderSummaryRow detail label="Preferred date" value={readableDate(delivery?.date ?? pickup?.date ?? '')} />
          {pickup && <OrderSummaryRow detail label="Preferred time" value={pickup.time} />}
          <OrderSummaryRow detail label="Payment" value={draft.payment === 'seller' ? 'Coordinate with seller' : delivery ? 'Pay upon delivery' : 'Pay upon pickup'} />
          <OrderSummaryRow total label="Estimated total" value={amountRange(draft.totalMin, draft.totalMax)} />
        </View>
      </OrderCard>

      <OrderCard title="What happens next">
        <View style={styles.nextSteps}>
          <OrderConfirmation title="Seller confirmation" description="Confirm livestock availability, the final price, and health records with the seller." status="Pending" />
          <OrderConfirmation title={delivery ? 'Confirm delivery' : 'Arrange pickup'} description={delivery ? 'Agree on the transport fee, vehicle, and delivery schedule before paying.' : 'Agree on the pickup point, date, and handover time before travelling.'} status="Pending" />
        </View>
        <OrderNotice>No payment has been collected. Review the livestock and confirmed arrangements before making a payment.</OrderNotice>
      </OrderCard>

      <View style={styles.actions}>
        <CheckoutButton label="View Order Status" onPress={onStatus} />
        <CheckoutButton secondary label="My Orders" onPress={onOrders} />
        <CheckoutButton secondary label="Continue Browsing" onPress={onMarketplace} />
      </View>
    </ScrollView>
  </OrderPage>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingHorizontal: 16 },
  hero: { borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 18 },
  check: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffffff24', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle: { color: '#fff', fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  heroCopy: { color: '#edf7ef', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  heroReference: { width: '100%', alignItems: 'center', gap: 5, borderTopWidth: 1, borderTopColor: '#ffffff40', paddingTop: 16, marginTop: 18 },
  referenceLabel: { color: '#d8efdf', fontSize: 13, lineHeight: 18 },
  reference: { color: '#fff', fontSize: 16, lineHeight: 22, fontWeight: '800', textAlign: 'center' },
  badge: { marginBottom: 14 },
  details: { marginTop: 12 },
  nextSteps: { gap: 16 },
  actions: { gap: 10 },
  body: { color: color.muted, fontSize: 14, lineHeight: 20 },
  missing: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 16 },
  missingTitle: { color: color.green, fontSize: 24, lineHeight: 30, fontWeight: '700' },
});
