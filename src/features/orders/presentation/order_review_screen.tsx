import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { livestockAmount, type CheckoutDraft, type OrderRequest, type SaveOrderResult } from '../domain/checkout';
import { CheckoutButton, checkoutColors as color, checkoutIcons as icons, CheckoutSheet, FieldError } from './checkout_controls';
import { amountRange, money, OrderNotice, OrderSteps, OrderSummaryRow, readableDate } from './order_components';
import { OrderBadge as Badge, OrderCard as ReviewCard, OrderConfirmation as Confirmation, OrderItem } from './order_cards';

function Person({ name, description, badge }: { name: string; description: string; badge: string }) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.15;
  const initials = name.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).filter((_, index, parts) => index === 0 || index === parts.length - 1).join('').toUpperCase();
  const diameter = Math.max(44, Math.ceil(20 * fontScale + 8));
  return <View style={styles.person}>
    <View accessible={false} style={[styles.avatar, { width: diameter, height: diameter, borderRadius: diameter / 2 }]}><Text style={styles.avatarText}>{initials || '?'}</Text></View>
    <View style={styles.personCopy}><Text style={styles.personName}>{name}</Text><Text style={styles.body}>{description}</Text>{compact && <View style={styles.inlineBadge}><Badge label={badge} /></View>}</View>
    {!compact && <Badge label={badge} />}
  </View>;
}

export function OrderReviewScreen({ draft, example = false, buyerName = '', buyerPhone = '', savedRequest, onBack, onEdit, onViewListing, onSave, onContinue, onStatus }: {
  draft?: CheckoutDraft; example?: boolean; buyerName?: string; buyerPhone?: string; savedRequest?: OrderRequest;
  onBack: () => void; onEdit: () => void; onViewListing?: () => void;
  onSave: (reviewed: boolean) => SaveOrderResult; onContinue: () => void;
  onStatus: (orderId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.15;
  const stackActions = width < 380 || fontScale > 1.05;
  const [agreed, setAgreed] = useState(!!savedRequest);
  const [request, setRequest] = useState(savedRequest ?? null);
  const [listingPreviewOpen, setListingPreviewOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function saveRequest() {
    if (request) return;
    const result = onSave(agreed);
    setError(result.error ?? undefined);
    if (result.request) { setRequest(result.request); onStatus(result.request.id); }
  }

  if (!draft) return <View style={[styles.missing, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
    <StatusBar style="dark" /><Text accessibilityRole="header" style={styles.missingTitle}>Review Order</Text>
    <Text style={styles.body}>Complete the checkout details before reviewing this order.</Text>
    <CheckoutButton label="Go to Checkout" onPress={onEdit} /><CheckoutButton secondary label="Back to Marketplace" onPress={onContinue} />
  </View>;

  const { item, delivery, pickup } = draft;
  const participantName = buyerName.trim() || delivery?.receiver || 'Current buyer';
  const participantPhone = buyerPhone.trim() || delivery?.phone;
  const payment = draft.payment === 'seller' ? 'Coordinate payment with seller' : delivery ? 'Pay upon delivery' : 'Pay upon pickup';
  const livestock = livestockAmount(item);

  return <View style={styles.background}>
    <StatusBar style="dark" />
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}><SymbolView name={icons.back} size={20} tintColor={color.green} /></Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>Review Order</Text><View style={styles.back} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <OrderSteps current={1} />
        {example && <View style={styles.exampleBanner}><Text style={styles.exampleTitle}>Example order</Text><Text style={styles.body}>This sample livestock listing uses your checkout details when available.</Text></View>}

        <ReviewCard title="Order item (1)" meta={`Listing ${item.listingReference ?? item.id} • Quantity 1`} action="View Listing" onAction={onViewListing ?? (() => setListingPreviewOpen(true))}>
          <OrderItem item={item} />
        </ReviewCard>

        <ReviewCard title="Pickup or Delivery" action="Edit" onAction={onEdit}>
          <View style={styles.methodCard}>
            <View style={styles.methodIcon}><SymbolView name={delivery ? icons.truck : icons.pin} size={24} tintColor={color.green} /></View>
            <View style={styles.methodCopy}><Text style={styles.methodTitle}>{delivery ? 'Delivery' : 'Seller Pickup'}</Text><Text style={styles.body}>{delivery ? 'Optional livestock transport requested. Confirm the final fee and schedule.' : 'Collect the livestock at the seller pickup point.'}</Text></View>
          </View>
          <View style={styles.details}>
            {delivery ? <>
              <OrderSummaryRow detail label="Preferred date" value={readableDate(delivery.date)} />
              <OrderSummaryRow detail label="Receiver" value={`${delivery.receiver} • ${delivery.phone}`} />
              <OrderSummaryRow detail label="Address" value={[delivery.street, delivery.barangay, delivery.city, delivery.province, delivery.postal].join(', ')} />
              <OrderSummaryRow detail label="Landmark" value={delivery.landmark || 'None provided'} />
              <OrderSummaryRow detail label="Transport notes" value={delivery.notes || 'None provided'} />
              <OrderSummaryRow detail label="Fee estimate" value={amountRange(delivery.feeMin, delivery.feeMax)} />
            </> : pickup && <>
              <OrderSummaryRow detail label="Preferred date" value={readableDate(pickup.date)} />
              <OrderSummaryRow detail label="Preferred time" value={pickup.time} />
              <OrderSummaryRow detail label="Pickup point" value={item.sellerAddress} />
            </>}
          </View>
          {delivery && <View style={styles.transporter}>
            <View style={[styles.transporterTop, compact && styles.column]}><Text style={[styles.transporterName, compact && styles.noFlex]}>Davao Livestock Transport Cooperative</Text><Badge label="To confirm" pending /></View>
            <Text style={styles.body}>Livestock-ready vehicle • Ventilated partitions</Text><Text style={styles.body}>Vehicle availability and the final quote require confirmation.</Text>
          </View>}
        </ReviewCard>

        <ReviewCard title="Buyer & Seller" meta="Order participants">
          <Person name={participantName} description={`Buyer${participantPhone ? ` • ${participantPhone}` : delivery ? ' • Delivery requested' : ' • Collects livestock from the seller'}`} badge="Buyer" />
          <View style={styles.divider} />
          <Person name={item.seller} description={item.sellerAddress} badge={item.verified ? 'Verified' : 'Seller'} />
        </ReviewCard>

        <ReviewCard title="Documents & Confirmations" meta="Review before sending">
          <View style={styles.confirmations}>
            <Confirmation title="Vaccination proof" description={item.vaccinationProofName ? `Attached: ${item.vaccinationProofName}` : item.healthVerified ? 'Health records are noted in the listing. Review them with the seller.' : 'Ask the seller for vaccination and health records.'} status={item.vaccinationProofName ? 'Attached' : 'To confirm'} ready={!!item.vaccinationProofName} />
            <Confirmation title={delivery ? 'Receiver and destination' : 'Pickup details'} description={delivery ? 'Required delivery details and vehicle access supplied.' : 'Preferred date, time, and seller pickup point supplied.'} status="Ready" ready />
            <Confirmation title="Seller acceptance" description="Required before the order becomes active." status="To confirm" />
            <Confirmation title={delivery ? 'Transport requirements' : 'Pickup arrangement'} description={delivery ? 'Confirm vehicle suitability, permits, and the final quote.' : 'Confirm the meeting point and schedule with the seller.'} status="To confirm" />
          </View>
        </ReviewCard>

        <ReviewCard title="Payment Arrangement" action="Edit" onAction={onEdit}>
          <View style={styles.paymentBox}><View style={styles.paymentIcon}><SymbolView name={icons.payment} size={22} tintColor={color.green} /></View><View style={styles.methodCopy}><Text style={styles.methodTitle}>{payment}</Text><Text style={styles.body}>No payment is collected on this screen.</Text></View></View>
          <OrderNotice>Send payment only after the seller confirms livestock availability, the final price, and the pickup or delivery arrangement.</OrderNotice>
        </ReviewCard>

        <ReviewCard title="Order Summary" meta="1 listing • Quantity 1">
          <OrderSummaryRow label="Livestock price" value={livestock === null ? 'Seller to confirm' : money(livestock)} />
          <OrderSummaryRow label={delivery ? 'Estimated delivery fee' : 'Pickup'} value={delivery ? amountRange(delivery.feeMin, delivery.feeMax) : 'Free'} />
          <OrderSummaryRow label={delivery ? 'Estimated total' : 'Total'} value={amountRange(draft.totalMin, draft.totalMax)} total />
          {item.priceUnit === 'per kg' && <Text style={styles.helper}>Based on {item.weight} at {money(item.price)} per kg. Final live weight requires seller confirmation.</Text>}
          <Text style={styles.helper}>{delivery ? 'The final delivery fee and total depend on the confirmed route and schedule.' : 'No delivery fee is included for seller pickup.'}</Text>
        </ReviewCard>

        <Pressable accessibilityRole="checkbox" accessibilityLabel="I reviewed this order and understand that the seller must confirm availability, price, and schedule" accessibilityState={{ checked: agreed, disabled: !!request }} disabled={!!request} onPress={() => { setAgreed(!agreed); setError(undefined); }} style={styles.agreement}>
          <View style={[styles.checkbox, agreed && styles.checked]}>{agreed && <SymbolView name={icons.check} size={16} tintColor="#fff" />}</View>
          <Text style={styles.agreementCopy}><Text style={styles.bold}>I reviewed this order.</Text> I understand that livestock availability, the final price, and the schedule require seller confirmation.</Text>
        </Pressable>
        <FieldError message={error} />
        {request && <View accessibilityRole="alert" style={styles.savedBanner}><Text style={styles.exampleTitle}>Request saved locally</Text><Text style={styles.body}>{request.id}</Text><CheckoutButton secondary label="View Order Status" onPress={() => onStatus(request.id)} /></View>}
        <View style={[styles.actions, stackActions && styles.column]}>
          <View style={[styles.editAction, stackActions && styles.noFlex]}><CheckoutButton secondary label="Edit Order" onPress={onEdit} /></View>
          <View style={[styles.sendAction, stackActions && styles.noFlex]}><CheckoutButton label={request ? 'Request Saved' : 'Send Order Request'} disabled={!agreed || !!request} onPress={saveRequest} /></View>
        </View>
        <Text style={styles.finePrint}>Demo requests are saved in your current session. The seller is not notified and no payment is collected.</Text>
      </ScrollView>
      <CheckoutSheet title="Example livestock listing" visible={listingPreviewOpen} onClose={() => setListingPreviewOpen(false)}>
        <Text style={styles.productTitle}>{item.title}</Text><Text style={styles.body}>{item.weight} • {item.health}</Text>
        <OrderSummaryRow label="Listing price" value={`${money(item.price)}${item.priceUnit ? ` ${item.priceUnit}` : ''}`} />
        <Text style={styles.body}>Seller: {item.seller}</Text><Text style={styles.body}>{item.sellerAddress}</Text>
        {!!item.availability && <Text style={styles.body}>Pickup availability: {item.availability}</Text>}
        <Text style={styles.finePrint}>This is a sample listing for the order screens.</Text>
        <CheckoutButton secondary label="Back to Review" onPress={() => setListingPreviewOpen(false)} />
      </CheckoutSheet>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#eef3ef' },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: color.line },
  back: { width: 44, minHeight: 58, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, minWidth: 0, paddingVertical: 12, textAlign: 'center', fontSize: 24, lineHeight: 30, fontWeight: '700', color: color.green },
  content: { paddingTop: 18, paddingHorizontal: 16 },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  noFlex: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  exampleBanner: { borderWidth: 1, borderColor: '#cfe1d4', backgroundColor: '#eef7f0', borderRadius: 12, padding: 12, marginBottom: 14 },
  exampleTitle: { color: color.green, fontSize: 13, lineHeight: 18, fontWeight: '700', marginBottom: 4 },
  body: { color: color.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  productTitle: { color: color.text, fontSize: 15, lineHeight: 19, fontWeight: '800', marginBottom: 3 },
  methodCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: color.mint, borderWidth: 1, borderColor: '#cee2d4', borderRadius: 13, padding: 12 },
  methodIcon: { width: 40, height: 40, flexShrink: 0, backgroundColor: '#fff', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  methodCopy: { flex: 1, minWidth: 0 },
  methodTitle: { color: color.green, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  details: { marginTop: 10 },
  transporter: { marginTop: 12, borderWidth: 1, borderColor: '#d7e5db', backgroundColor: '#f6faf7', borderRadius: 12, padding: 12 },
  transporterTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  transporterName: { flex: 1, minWidth: 0, color: color.green, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  person: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: { flexShrink: 0, backgroundColor: color.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '800' },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { color: color.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#edf2ee', marginVertical: 12 },
  inlineBadge: { marginTop: 6 },
  confirmations: { gap: 14 },
  paymentBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: '#f6faf7', borderWidth: 1, borderColor: color.line, borderRadius: 12, padding: 12 },
  paymentIcon: { width: 38, height: 38, flexShrink: 0, backgroundColor: color.mint, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  helper: { color: color.muted, fontSize: 13, lineHeight: 18, marginTop: 8 },
  agreement: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: color.line, borderRadius: 13, padding: 12, marginBottom: 12, backgroundColor: '#f6faf7' },
  checkbox: { width: 22, height: 22, flexShrink: 0, borderWidth: 1, borderColor: '#a7b9ad', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checked: { borderColor: color.green, backgroundColor: color.green },
  agreementCopy: { flex: 1, minWidth: 0, color: color.muted, fontSize: 13, lineHeight: 18 },
  bold: { color: color.text, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginTop: 4 },
  editAction: { flex: 1, minWidth: 0 },
  sendAction: { flex: 1.45, minWidth: 0 },
  finePrint: { color: color.muted, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 12, paddingHorizontal: 6 },
  savedBanner: { borderWidth: 1, borderColor: '#cfe1d4', backgroundColor: '#eef7f0', borderRadius: 12, padding: 12, marginBottom: 12 },
  missing: { flex: 1, justifyContent: 'center', gap: 16, paddingHorizontal: 24, backgroundColor: '#fff' },
  missingTitle: { color: color.green, fontSize: 24, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
});
