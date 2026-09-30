import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocationPreview } from '@/features/location/presentation/location_preview';

import { livestockAmount, type OrderRequest, type SaveOrderResult } from '../domain/checkout';
import { orderProgress, orderStatusCopy } from '../domain/order_status';
import { CheckoutButton, checkoutColors as color, checkoutIcons as icons, CheckoutSheet, FieldError } from './checkout_controls';
import { OrderBadge, OrderCard, OrderConfirmation, OrderItem } from './order_cards';
import { amountRange, money, OrderNotice, OrderSummaryRow, readableDate } from './order_components';

export function OrderStatusScreen({ order, example = false, onBack, onMarketplace, onViewListing, onMessage, onCancel }: {
  order?: OrderRequest; example?: boolean; onBack: () => void; onMarketplace: () => void;
  onViewListing?: () => void; onMessage?: () => void; onCancel: (orderId: string) => SaveOrderResult;
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.15;
  const stackActions = width < 380 || fontScale > 1.05;
  const [exampleRequest, setExampleRequest] = useState(order);
  const request = example ? exampleRequest : order;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [listingOpen, setListingOpen] = useState(false);
  const [contactAction, setContactAction] = useState<'phone' | 'message' | null>(null);
  const [error, setError] = useState<string | undefined>();

  function cancelRequest() {
    if (!request) return;
    const result = onCancel(request.id);
    setError(result.error ?? undefined);
    if (result.request) { if (example) setExampleRequest(result.request); setCancelOpen(false); }
  }
  function messageSeller() {
    if (onMessage) onMessage(); else setContactAction('message');
  }

  if (!request) return <View style={[styles.missing, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
    <StatusBar style="dark" /><Text accessibilityRole="header" style={styles.missingTitle}>Order unavailable</Text>
    <Text style={styles.body}>This order request is not available in the current session.</Text><CheckoutButton label="My Orders" onPress={onBack} /><CheckoutButton secondary label="Back to Marketplace" onPress={onMarketplace} />
  </View>;

  const { item, delivery, pickup } = request.draft;
  const cancelled = request.status === 'cancelled';
  const copy = orderStatusCopy(request);
  const steps = orderProgress(request);
  const livestock = livestockAmount(item);
  const payment = request.draft.payment === 'seller' ? 'Coordinate with seller' : delivery ? 'Pay upon delivery' : 'Pay upon pickup';
  const readyCount = Number(!!item.vaccinationProofName) + 1;
  const initials = item.seller.trim().split(/\s+/).filter(Boolean).map((word) => word[0]).filter((_, index, parts) => index === 0 || index === parts.length - 1).join('').toUpperCase();
  const avatarDiameter = Math.max(44, Math.ceil(20 * fontScale + 8));
  const contactButtons = <View style={styles.miniActions}>
    <Pressable accessibilityRole="button" accessibilityLabel="Call seller" onPress={() => setContactAction('phone')} style={({ pressed }) => [styles.miniButton, pressed && styles.pressed]}><SymbolView name={icons.phone} size={19} tintColor={color.green} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Message seller" onPress={messageSeller} style={({ pressed }) => [styles.miniButton, pressed && styles.pressed]}><SymbolView name={icons.chat} size={19} tintColor={color.green} /></Pressable>
  </View>;

  return <View style={styles.background}>
    <StatusBar style="dark" />
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}><SymbolView name={icons.back} size={20} tintColor={color.green} /></Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>Order Status</Text><View style={styles.back} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {example && <View style={styles.exampleBanner}><Text style={styles.exampleTitle}>Example active order</Text><Text style={styles.body}>This sample appears when Order Status is opened directly. A saved checkout request opens its own status page.</Text></View>}
        <LinearGradient colors={cancelled ? ['#73352f', '#a13a32'] : ['#12372a', '#2d6a4f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={[styles.heroTop, compact && styles.column]}><View style={styles.heroMark}><SymbolView name={cancelled ? icons.close : icons.check} size={24} tintColor="#fff" /></View><Text style={styles.statusPill}>{copy.pill}</Text></View>
          <Text accessibilityRole="header" style={styles.heroTitle}>{copy.title}</Text><Text style={styles.heroCopy}>{copy.description}</Text>
          <View style={[styles.heroMeta, compact && styles.column]}>
            <View style={[styles.heroMetaCell, compact && styles.noFlex]}><Text style={styles.heroMetaValue}>{request.id}</Text><Text style={styles.heroMetaLabel}>Order number</Text></View>
            <View style={[styles.heroMetaCell, compact ? styles.noFlex : styles.heroMetaRight]}><Text style={[styles.heroMetaValue, !compact && styles.rightText]}>{new Date(request.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</Text><Text style={[styles.heroMetaLabel, !compact && styles.rightText]}>Request date</Text></View>
          </View>
        </LinearGradient>

        <OrderCard title="Order item (1)" meta={`Listing ${item.listingReference ?? item.id} • Quantity 1`}><OrderItem item={item} /></OrderCard>
        <OrderCard title="Order Progress" meta={cancelled ? 'Cancelled' : 'Step 1 of 5'}>
          <View style={styles.timeline}>{steps.map((step, index) => <View key={step.title} accessible accessibilityLabel={`${step.state === 'future' ? 'Upcoming' : step.state === 'cancelled' ? 'Cancelled' : 'Current'}: ${step.title}. ${step.description}`} style={styles.event}>
            <View style={styles.eventRail}><View style={[styles.dot, step.state === 'current' && styles.currentDot, step.state === 'cancelled' && styles.cancelledDot]} />{index < steps.length - 1 && <View style={styles.connector} />}</View>
            <View style={[styles.eventCopy, index === steps.length - 1 && styles.lastEvent]}><Text style={[styles.eventTitle, step.state === 'future' && styles.futureTitle, step.state === 'cancelled' && styles.cancelledText]}>{step.title}</Text><Text style={styles.body}>{step.description}</Text></View>
          </View>)}</View>
        </OrderCard>

        <OrderCard title="Pickup or Delivery" meta={delivery ? 'Delivery' : 'Pickup'}>
          <View style={styles.methodCard}><View style={styles.methodIcon}><SymbolView name={delivery ? icons.truck : icons.pin} size={24} tintColor={color.green} /></View><View style={styles.methodCopy}><Text style={styles.methodTitle}>{delivery ? 'Delivery requested' : 'Seller pickup'}</Text><Text style={styles.body}>{cancelled ? 'The arrangement below belongs to the cancelled request.' : delivery ? 'Transport arrangements begin after seller and transporter confirmation.' : 'The seller must confirm the pickup date, time, and handover instructions.'}</Text></View></View>
          <View style={styles.details}>{delivery ? <>
            <OrderSummaryRow detail label="Preferred date" value={readableDate(delivery.date)} />
            <OrderSummaryRow detail label="Receiver" value={`${delivery.receiver} • ${delivery.phone}`} />
            <OrderSummaryRow detail label="Destination" value={[delivery.street, delivery.barangay, delivery.city, delivery.province, delivery.postal].join(', ')} />
            <OrderSummaryRow detail label="Landmark" value={delivery.landmark || 'None provided'} />
            {!!delivery.notes && <OrderSummaryRow detail label="Transport notes" value={delivery.notes} />}
            <OrderSummaryRow detail label="Estimated fee" value={amountRange(delivery.feeMin, delivery.feeMax)} />
          </> : pickup && <>
            <OrderSummaryRow detail label="Preferred date" value={readableDate(pickup.date)} /><OrderSummaryRow detail label="Preferred time" value={pickup.time} /><OrderSummaryRow detail label="Pickup point" value={item.sellerAddress} />
          </>}</View>
          {delivery && <LocationPreview label={example ? 'Example destination pin' : 'Confirmed delivery destination'} coordinate={delivery.location.coordinate} />}
          {request.pickupPin && <LocationPreview label="Seller pickup point" coordinate={request.pickupPin} />}
          {!delivery && !request.pickupPin && <Text style={styles.body}>The seller has not provided an exact pickup pin. Confirm the meeting point with the seller.</Text>}
          {delivery && <View style={styles.transporter}><View style={[styles.transporterTop, compact && styles.column]}><Text style={[styles.transporterName, compact && styles.noFlex]}>Davao Livestock Transport Cooperative</Text><OrderBadge label="To confirm" pending /></View><Text style={styles.body}>Livestock-ready vehicle • Ventilated partitions</Text><Text style={styles.body}>Vehicle availability, driver details, and the final quote require confirmation.</Text></View>}
        </OrderCard>

        <OrderCard title="Payment Summary" meta={payment}>
          <OrderSummaryRow label="Livestock price" value={livestock === null ? 'Seller to confirm' : money(livestock)} /><OrderSummaryRow label={delivery ? 'Estimated delivery fee' : 'Pickup'} value={delivery ? amountRange(delivery.feeMin, delivery.feeMax) : 'Free'} />
          <OrderSummaryRow label={cancelled ? 'Previous estimate' : delivery ? 'Estimated total' : 'Total'} value={amountRange(request.draft.totalMin, request.draft.totalMax)} total />
          {item.priceUnit === 'per kg' && <Text style={styles.helper}>Based on {item.weight} at {money(item.price)} per kg. Final live weight requires seller confirmation.</Text>}
          <Text style={styles.helper}>{cancelled ? 'The request was cancelled. No payment was collected.' : delivery ? 'The final delivery fee and total depend on the confirmed route and schedule.' : 'No delivery fee is included for seller pickup.'}</Text>
        </OrderCard>

        <OrderCard title="Documents & Confirmations" meta={`${readyCount} of 4 ready`}>
          <View style={styles.confirmations}>
            <OrderConfirmation title="Vaccination proof" description={item.vaccinationProofName ? `Attached: ${item.vaccinationProofName}` : item.healthVerified ? 'Health records are noted in the listing. Review them with the seller.' : 'Ask the seller for vaccination and health records.'} status={item.vaccinationProofName ? 'Ready' : 'Pending'} ready={!!item.vaccinationProofName} />
            <OrderConfirmation title={delivery ? 'Buyer receiver details' : 'Buyer pickup details'} description={delivery ? 'Receiver and destination provided.' : 'Preferred pickup date, time, and location provided.'} status="Ready" ready />
            <OrderConfirmation title="Seller confirmation" description="Livestock availability and handover terms." status="Pending" />
            <OrderConfirmation title={delivery ? 'Transport requirements' : 'Pickup arrangement'} description={delivery ? 'Vehicle, permits, and final quote, when required.' : 'Confirm the meeting point and schedule.'} status="Pending" />
          </View>
        </OrderCard>

        <OrderCard title="Seller" meta={item.verified ? 'Verified Raiser' : 'Verification to confirm'}>
          <View style={styles.contact}><View accessible={false} style={[styles.avatar, { width: avatarDiameter, height: avatarDiameter, borderRadius: avatarDiameter / 2 }]}><Text style={styles.avatarText}>{initials || '?'}</Text></View><View style={styles.contactCopy}><Text style={styles.sellerName}>{item.seller}</Text><Text style={styles.body}>{item.sellerAddress}</Text>{compact && contactButtons}</View>{!compact && contactButtons}</View>
        </OrderCard>
        <OrderNotice>{cancelled ? 'This request is cancelled. You can return to the listing to review availability before making a new request.' : delivery ? 'Delivery remains optional until the seller accepts and the buyer approves the final transport quote. Confirm pickup or delivery with the seller before payment.' : 'Bring suitable livestock transport and any documents agreed with the seller. Both parties must confirm the handover.'}</OrderNotice>
        <View style={[styles.actions, stackActions && styles.column]}><View style={[styles.actionCell, stackActions && styles.noFlex]}><CheckoutButton secondary label="View Listing" onPress={onViewListing ?? (() => setListingOpen(true))} /></View><View style={[styles.actionCell, stackActions && styles.noFlex]}><CheckoutButton label="Message Seller" onPress={messageSeller} /></View></View>
        {!cancelled && <Pressable accessibilityRole="button" onPress={() => { setError(undefined); setCancelOpen(true); }} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelledText}>Cancel order request</Text></Pressable>}
        {!cancelOpen && <FieldError message={error} />}
      </ScrollView>

      <CheckoutSheet title="Cancel order request?" visible={cancelOpen} onClose={() => setCancelOpen(false)}>
        <Text style={styles.body}>Cancel {request.id}? The order details will remain available in this session. No seller notification or payment will be sent.</Text><FieldError message={error} />
        <Pressable accessibilityRole="button" onPress={cancelRequest} style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}><Text style={styles.dangerButtonText}>Cancel Request</Text></Pressable><CheckoutButton secondary label="Keep Request" onPress={() => setCancelOpen(false)} />
      </CheckoutSheet>
      <CheckoutSheet title={contactAction === 'phone' ? 'Call Seller' : 'Message Seller'} visible={contactAction !== null} onClose={() => setContactAction(null)}>
        <Text style={styles.sellerName}>{item.seller}</Text><Text style={styles.body}>{contactAction === 'phone' ? 'The seller has not provided a phone number for this listing.' : 'A seller conversation is not connected to this listing yet.'}</Text><CheckoutButton secondary label="Close" onPress={() => setContactAction(null)} />
      </CheckoutSheet>
      <CheckoutSheet title="Listing details" visible={listingOpen} onClose={() => setListingOpen(false)}>
        <OrderItem item={item} /><Text style={styles.body}>{item.sellerAddress}</Text><Text style={styles.helper}>Livestock information recorded with this request.</Text><CheckoutButton secondary label="Back to Order Status" onPress={() => setListingOpen(false)} />
      </CheckoutSheet>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#eef3ef' }, screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: color.line }, back: { width: 44, minHeight: 58, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, minWidth: 0, paddingVertical: 12, textAlign: 'center', fontSize: 24, lineHeight: 30, fontWeight: '700', color: color.green }, content: { paddingTop: 18, paddingHorizontal: 16 },
  column: { flexDirection: 'column', alignItems: 'stretch' }, noFlex: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }, body: { color: color.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  exampleBanner: { borderWidth: 1, borderColor: '#cfe1d4', backgroundColor: '#eef7f0', borderRadius: 12, padding: 12, marginBottom: 14 }, exampleTitle: { color: color.green, fontSize: 13, lineHeight: 18, fontWeight: '700', marginBottom: 4 },
  hero: { borderRadius: 18, padding: 17, marginBottom: 14 }, heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, heroMark: { width: 42, height: 42, flexShrink: 0, borderRadius: 21, backgroundColor: '#ffffff20', alignItems: 'center', justifyContent: 'center' },
  statusPill: { alignSelf: 'flex-start', flexShrink: 1, maxWidth: '100%', paddingVertical: 6, paddingHorizontal: 9, borderRadius: 12, backgroundColor: '#fff', color: color.green, fontSize: 12, lineHeight: 16, fontWeight: '800', overflow: 'hidden' },
  heroTitle: { color: '#fff', fontSize: 18, lineHeight: 24, fontWeight: '700', marginTop: 12, marginBottom: 6 }, heroCopy: { color: '#e7f1ea', fontSize: 13, lineHeight: 18 }, heroMeta: { flexDirection: 'row', gap: 12, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#ffffff24' }, heroMetaCell: { flex: 1, minWidth: 0 }, heroMetaRight: { alignItems: 'flex-end' }, rightText: { textAlign: 'right' },
  heroMetaValue: { color: '#fff', fontSize: 13, lineHeight: 18, fontWeight: '700' }, heroMetaLabel: { color: '#d9e7de', fontSize: 13, lineHeight: 18, marginTop: 3 },
  timeline: { marginLeft: 4 }, event: { flexDirection: 'row', alignItems: 'stretch', gap: 12 }, eventRail: { width: 22, flexShrink: 0, alignItems: 'center', paddingTop: 2 }, dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#edf2ee', backgroundColor: '#becbc2' }, currentDot: { borderColor: '#d8f3dc', backgroundColor: color.green }, cancelledDot: { borderColor: '#f8dad5', backgroundColor: color.danger }, connector: { width: 2, flex: 1, marginTop: 3, backgroundColor: color.line }, eventCopy: { flex: 1, minWidth: 0, paddingBottom: 20 }, lastEvent: { paddingBottom: 0 }, eventTitle: { color: color.green, fontSize: 15, lineHeight: 20, fontWeight: '700' }, futureTitle: { color: color.muted },
  methodCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: color.mint, borderWidth: 1, borderColor: '#cee2d4', borderRadius: 13, padding: 12 }, methodIcon: { width: 40, height: 40, flexShrink: 0, backgroundColor: '#fff', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, methodCopy: { flex: 1, minWidth: 0 }, methodTitle: { color: color.green, fontSize: 15, lineHeight: 20, fontWeight: '700' }, details: { marginTop: 10 },
  transporter: { marginTop: 12, borderWidth: 1, borderColor: '#d7e5db', backgroundColor: '#f6faf7', borderRadius: 12, padding: 12 }, transporterTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 }, transporterName: { flex: 1, minWidth: 0, color: color.green, fontSize: 15, lineHeight: 20, fontWeight: '700' }, helper: { color: color.muted, fontSize: 13, lineHeight: 18, marginTop: 8 }, confirmations: { gap: 14 },
  contact: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, avatar: { flexShrink: 0, backgroundColor: color.green, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '800' }, contactCopy: { flex: 1, minWidth: 0 }, sellerName: { color: color.text, fontSize: 15, lineHeight: 20, fontWeight: '700' }, miniActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 }, miniButton: { width: 44, height: 44, borderWidth: 1, borderColor: color.green, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginTop: 14 }, actionCell: { flex: 1, minWidth: 0 }, cancel: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 8, marginTop: 6, alignItems: 'center', justifyContent: 'center' }, cancelledText: { color: color.danger, fontSize: 13, lineHeight: 18, fontWeight: '700' }, pressed: { opacity: 0.75 }, dangerButton: { minHeight: 50, padding: 12, borderRadius: 12, backgroundColor: color.danger, alignItems: 'center', justifyContent: 'center' }, dangerButtonText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800', textAlign: 'center' },
  missing: { flex: 1, justifyContent: 'center', gap: 16, paddingHorizontal: 24, backgroundColor: '#fff' }, missingTitle: { color: color.green, fontSize: 24, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
});
