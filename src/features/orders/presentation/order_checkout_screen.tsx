import { useRef, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getListingImage } from '@/features/marketplace/presentation/listing_images';

import type { CheckoutService } from '../application/checkout_service';
import { checkoutTotals, DELIVERY_PROVINCES, emptyCheckoutForm, parseDate, PICKUP_TIMES, validateCheckout, type CheckoutDraft, type CheckoutForm, type CheckoutItem } from '../domain/checkout';
import { CheckoutButton, checkoutColors as color, CheckoutDate, CheckoutField, checkoutIcons as icons, CheckoutSelect, CheckoutSheet, FieldError } from './checkout_controls';

const paymentOptions = [{ value: 'cod', label: 'Pay upon meetup / delivery' }, { value: 'seller', label: 'Coordinate payment with seller' }] as const;
const money = (value: number) => `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const amountRange = (min: number, max: number) => min === max ? money(min) : `${money(min)}–${money(max)}`;
const readableDate = (value: string) => parseDate(value)?.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) ?? value;

function Notice({ children }: { children: string }) {
  return <View style={styles.notice}><Text style={styles.noticeText}>{children}</Text></View>;
}

function SummaryRow({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return <View style={[styles.summaryRow, total && styles.totalRow]}><Text style={[styles.summaryLabel, total && styles.totalLabel]}>{label}</Text><Text style={[styles.summaryValue, total && styles.totalValue]}>{value}</Text></View>;
}

function ReviewSummary({ draft, onClose }: { draft: CheckoutDraft; onClose: () => void }) {
  const delivery = draft.delivery;
  return <>
    <Text style={styles.reviewTitle}>{draft.item.title}</Text>
    <Text style={styles.reviewCopy}>Seller: {draft.item.seller}</Text>
    <View style={styles.reviewGroup}>
      <Text style={styles.sectionTitle}>{delivery ? 'Delivery details' : 'Pickup details'}</Text>
      {delivery ? <>
        <Text style={styles.reviewCopy}>{readableDate(delivery.date)}{'\n'}{delivery.receiver} • {delivery.phone}</Text>
        <Text style={styles.reviewCopy}>{[delivery.street, delivery.barangay, delivery.city, delivery.province, delivery.postal].join(', ')}</Text>
        {!!delivery.landmark && <Text style={styles.reviewCopy}>Landmark: {delivery.landmark}</Text>}
        {!!delivery.notes && <Text style={styles.reviewCopy}>Transport instructions: {delivery.notes}</Text>}
      </> : <Text style={styles.reviewCopy}>{readableDate(draft.pickup!.date)}{'\n'}{draft.pickup!.time}{'\n'}{draft.item.sellerAddress}</Text>}
    </View>
    <View style={styles.reviewGroup}><Text style={styles.sectionTitle}>Payment arrangement</Text><Text style={styles.reviewCopy}>{paymentOptions.find((option) => option.value === draft.payment)?.label}</Text></View>
    <SummaryRow label="Estimated total" value={amountRange(draft.totalMin, draft.totalMax)} total />
    <Notice>Confirm livestock availability, payment terms, and the final schedule with the seller. Reviewing these details does not send payment or place an order.</Notice>
    <CheckoutButton secondary label="Edit Details" onPress={onClose} />
  </>;
}

export function OrderCheckoutScreen({ item, service, receiverName = '', receiverPhone = '', onBack }: {
  item?: CheckoutItem; service: CheckoutService; receiverName?: string; receiverPhone?: string; onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.25;
  const scroll = useRef<ScrollView>(null);
  const [form, setForm] = useState<CheckoutForm>(() => (item && service.getForm(item.id)) || emptyCheckoutForm(receiverName, receiverPhone));
  const [attempted, setAttempted] = useState(false);
  const [review, setReview] = useState<CheckoutDraft | null>(null);
  const errors = attempted && item ? validateCheckout(form, item) : {};
  const delivery = form.fulfillment === 'delivery';
  const totals = item ? checkoutTotals(item, form.fulfillment) : null;

  function update<K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function changeMode(fulfillment: CheckoutForm['fulfillment']) {
    update('fulfillment', fulfillment); setAttempted(false);
  }
  function reviewOrder() {
    if (!item) return;
    Keyboard.dismiss();
    const result = service.review(item, form);
    setAttempted(true);
    if (result.draft) { setReview(result.draft); return; }
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  if (!item) return <View style={[styles.missing, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <StatusBar style="dark" /><Text style={styles.reviewTitle}>Listing unavailable</Text><Text style={styles.reviewCopy}>This listing is no longer available for checkout.</Text><CheckoutButton label="Back to Marketplace" onPress={onBack} />
  </View>;

  const image = item.imageUri ? { uri: item.imageUri } : getListingImage(item.id);
  return <View style={styles.background}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}><SymbolView name={icons.back} size={20} tintColor={color.green} /></Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>Order Checkout</Text><View style={styles.back} />
      </View>
      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
        <View accessibilityLabel={`Checkout step ${review ? '2, Review' : '1, Details'} of 3`} style={styles.steps}>
          {['Details', 'Review', 'Placed'].map((label, index) => <View key={label} style={styles.stepSegment}>
            {index > 0 && <View style={styles.stepLine} />}
            <View style={[styles.step, compact && styles.column]}><View style={[styles.stepNumber, index === (review ? 1 : 0) && styles.stepActive]}><Text style={[styles.stepNumberText, index === (review ? 1 : 0) && styles.stepActiveText]}>{index + 1}</Text></View><Text style={[styles.stepLabel, index === (review ? 1 : 0) && styles.stepActiveLabel]}>{label}</Text></View>
          </View>)}
        </View>
        {Object.keys(errors).length > 0 && <View style={styles.errorBanner}><Text accessibilityRole="alert" style={styles.errorText}>Please complete the required details below.</Text><FieldError message={errors.listing} /></View>}
        <View style={[styles.card, styles.product]}>
          <LinearGradient colors={['#d8f3dc', '#95d5b2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumbnail}>{image && <Image source={image} contentFit="cover" accessibilityLabel={item.title} style={StyleSheet.absoluteFill} />}</LinearGradient>
          <View style={styles.productCopy}><Text style={styles.productTitle}>{item.title}</Text><Text style={styles.productMeta}>{item.weight} • {item.health}</Text><Text style={styles.productMeta}>Seller: {item.seller}</Text>{compact && <Text style={styles.productPrice}>{money(item.price)}{item.priceUnit === 'per kg' ? ' / kg' : ''}</Text>}</View>
          {!compact && <View style={styles.priceBlock}><Text style={styles.productPrice}>{money(item.price)}</Text>{item.priceUnit && <Text style={styles.priceUnit}>{item.priceUnit}</Text>}</View>}
        </View>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>How will you receive the livestock?</Text>
          <View style={[styles.choices, compact && styles.column]}>
            {([{ value: 'pickup', title: 'Pickup', icon: icons.pin, description: 'Meet the seller at the listed farm or agreed pickup point.' }, { value: 'delivery', title: 'Delivery', icon: icons.truck, description: 'Arrange livestock transport and provide a destination address.' }] as const).map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={`${option.title}. ${option.description}`} accessibilityState={{ checked: form.fulfillment === option.value }} onPress={() => changeMode(option.value)} style={[styles.choice, form.fulfillment === option.value && styles.choiceSelected]}>
              <View style={styles.choiceTop}><SymbolView name={option.icon} size={26} tintColor={color.green} /><View style={[styles.radio, form.fulfillment === option.value && styles.radioSelected]}>{form.fulfillment === option.value && <View style={styles.radioDot} />}</View></View>
              <Text style={styles.choiceTitle}>{option.title}</Text><Text style={styles.choiceDescription}>{option.description}</Text>
            </Pressable>)}
          </View>
          <Notice>Delivery is optional. The buyer and seller must confirm animal readiness, vehicle suitability, permits, fees, and the final schedule before transport.</Notice>
          {delivery ? <>
            <View style={styles.transportCard}>
              <View style={styles.transportTop}><Text style={styles.transportTitle}>Davao Livestock Transport Cooperative</Text><Text style={styles.estimateBadge}>Estimate</Text></View>
              <Text style={styles.transportCopy}>Livestock-ready truck • Ventilated partitions • Driver contact shared after seller confirmation</Text>
              <SummaryRow label="Estimated transport fee" value="₱2,500–₱3,500" total />
            </View>
            <CheckoutDate label="Preferred delivery date" value={form.deliveryDate} onSelect={(value) => update('deliveryDate', value)} error={errors.deliveryDate} />
            <CheckoutField label="Receiver name" required value={form.receiver} onChangeText={(value) => update('receiver', value)} placeholder="Full name" autoComplete="name" error={errors.receiver} />
            <CheckoutField label="Receiver phone" required value={form.phone} onChangeText={(value) => update('phone', value)} placeholder="09XX XXX XXXX" keyboardType="phone-pad" autoComplete="tel" maxLength={20} error={errors.phone} />
            <Text style={styles.addressHeading}>Delivery address</Text>
            <View style={[styles.addressRow, compact && styles.column]}>
              <View style={styles.addressCell}><CheckoutField label="Purok/Street" required value={form.street} onChangeText={(value) => update('street', value)} placeholder="Purok 2" error={errors.street} /></View>
              <View style={styles.addressCell}><CheckoutField label="Barangay" required value={form.barangay} onChangeText={(value) => update('barangay', value)} placeholder="Barangay name" error={errors.barangay} /></View>
            </View>
            <View style={[styles.addressRow, compact && styles.column]}>
              <View style={styles.addressCell}><CheckoutField label="Municipality/City" required value={form.city} onChangeText={(value) => update('city', value)} placeholder="Tagum City" error={errors.city} /></View>
              <View style={styles.addressCell}><CheckoutSelect label="Province" required value={form.province} onSelect={(value) => update('province', value)} options={DELIVERY_PROVINCES.map((province) => ({ label: province, value: province }))} placeholder="Select province" error={errors.province} /></View>
            </View>
            <View style={[styles.addressRow, compact && styles.column]}>
              <View style={styles.addressCell}><CheckoutField label="Postal code" required value={form.postal} onChangeText={(value) => update('postal', value.replace(/\D/g, ''))} placeholder="8100" keyboardType="number-pad" maxLength={4} error={errors.postal} /></View>
              <View style={styles.addressCell}><CheckoutField label="Landmark" value={form.landmark} onChangeText={(value) => update('landmark', value)} placeholder="Optional" /></View>
            </View>
            <CheckoutField label="Transport instructions" value={form.notes} onChangeText={(value) => update('notes', value)} placeholder="Gate access, unloading area, handling notes" multiline maxLength={1000} />
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.accessibleDestination }} accessibilityLabel="I confirm that a livestock transport vehicle can safely access the destination and that an adult receiver will be present" onPress={() => update('accessibleDestination', !form.accessibleDestination)} style={styles.checkRow}>
              <View style={[styles.checkbox, form.accessibleDestination && styles.checked]}>{form.accessibleDestination && <Text style={styles.checkmark}>✓</Text>}</View><Text style={styles.checkCopy}>I confirm that a livestock transport vehicle can safely access the destination and that an adult receiver will be present.</Text>
            </Pressable><FieldError message={errors.accessibleDestination} />
          </> : <>
            <View style={styles.pickupBox}>
              <Text style={styles.pickupTitle}>Seller pickup location</Text><Text style={styles.pickupCopy}>{item.sellerAddress}</Text>
              <Text style={styles.pickupCopy}>{item.availability ? <><Text style={styles.bold}>Available: </Text>{item.availability}</> : 'Confirm the pickup point and availability with the seller.'}</Text>
              <LinearGradient accessibilityLabel="Illustration of the pickup area" colors={['#d7eadc', '#f7fbf8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mapIllustration}>
                <View style={styles.mapRoad} /><View style={styles.mapPin}><SymbolView name={icons.pin} size={30} tintColor={color.green} /></View>
              </LinearGradient>
            </View>
            <CheckoutDate label="Preferred pickup date" value={form.pickupDate} onSelect={(value) => update('pickupDate', value)} error={errors.pickupDate} excludedDays={item.unavailablePickupDays} />
            <CheckoutSelect label="Preferred time" required value={form.pickupTime} onSelect={(value) => update('pickupTime', value)} options={PICKUP_TIMES.map((time) => ({ label: time, value: time }))} placeholder="Select time" error={errors.pickupTime} />
          </>}
        </View>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Payment arrangement</Text>
          <CheckoutSelect hideLabel label="Payment arrangement" value={form.payment} onSelect={(value) => update('payment', value as CheckoutForm['payment'])} options={paymentOptions} error={errors.payment} />
          <Notice>AniMarket records the order request. Do not send payment until the seller confirms availability, terms, and fulfillment details.</Notice>
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Estimated total</Text>
          <SummaryRow label="Livestock price" value={totals ? money(totals.livestock) : 'Seller to confirm'} />
          <SummaryRow label={delivery ? 'Estimated delivery fee' : 'Pickup'} value={delivery ? '₱2,500–₱3,500' : 'Free'} />
          <SummaryRow label="Estimated total" value={totals ? amountRange(totals.min, totals.max) : 'Seller to confirm'} total />
          {item.priceUnit === 'per kg' && <Text style={styles.helper}>Based on {item.weight} at {money(item.price)} per kg. Final live weight requires seller confirmation.</Text>}
          <Text style={styles.helper}>Delivery fees are estimates and require transporter confirmation.</Text>
        </View>
      </ScrollView>
      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 20) }]}><CheckoutButton label="Review Order" onPress={reviewOrder} /></View>
      <CheckoutSheet title="Review Order" visible={review !== null} onClose={() => setReview(null)}>{review && <ReviewSummary draft={review} onClose={() => setReview(null)} />}</CheckoutSheet>
    </KeyboardAvoidingView>
  </View>;
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#eef3ef' }, screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: color.line }, back: { width: 42, minHeight: 58, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, lineHeight: 24, fontWeight: '700', color: color.green }, content: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 8 },
  steps: { marginHorizontal: 4, flexDirection: 'row', marginBottom: 20 }, stepSegment: { flexGrow: 1, flexDirection: 'row', alignItems: 'center' }, stepLine: { flex: 1, minWidth: 8, height: 2, backgroundColor: '#dde6e0', marginHorizontal: 8 }, step: { flexDirection: 'row', alignItems: 'center', gap: 7 }, stepNumber: { width: 24, minHeight: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dde6e0' }, stepNumberText: { fontSize: 11, fontWeight: '700', color: '#64726a' }, stepLabel: { color: color.muted, fontSize: 11, lineHeight: 16 }, stepActive: { backgroundColor: color.green }, stepActiveText: { color: '#fff' }, stepActiveLabel: { color: color.green, fontWeight: '800' },
  card: { borderWidth: 1, borderColor: color.line, borderRadius: 16, padding: 14, marginBottom: 14, backgroundColor: '#fff' }, product: { flexDirection: 'row', alignItems: 'center', gap: 11 }, thumbnail: { width: 68, height: 68, borderRadius: 13, overflow: 'hidden' }, productCopy: { flex: 1, minWidth: 0 }, productTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: color.text, marginBottom: 3 }, productMeta: { fontSize: 11, lineHeight: 16, color: color.muted, marginTop: 2 }, priceBlock: { alignItems: 'flex-end', maxWidth: 88 }, productPrice: { fontSize: 14, lineHeight: 19, fontWeight: '800', color: color.green }, priceUnit: { fontSize: 10, lineHeight: 14, color: color.muted },
  sectionTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: color.green, marginBottom: 12 }, choices: { flexDirection: 'row', gap: 10 }, column: { flexDirection: 'column' }, choice: { flex: 1, minWidth: 0, minHeight: 128, borderWidth: 1.5, borderColor: color.line, borderRadius: 14, padding: 12 }, choiceSelected: { borderColor: color.green, backgroundColor: color.mint }, choiceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, choiceTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: color.green, marginTop: 7, marginBottom: 3 }, choiceDescription: { fontSize: 11, lineHeight: 15, color: color.muted }, radio: { width: 16, height: 16, borderWidth: 1, borderColor: '#cbd7cf', borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, radioSelected: { borderColor: color.green }, radioDot: { width: 8, height: 8, backgroundColor: color.green, borderRadius: 4 },
  notice: { borderWidth: 1, borderColor: color.warnLine, backgroundColor: color.warn, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginTop: 11 }, noticeText: { color: '#684500', fontSize: 11, lineHeight: 16 },
  pickupBox: { marginTop: 13, borderWidth: 1, borderColor: '#cfe1d4', backgroundColor: '#f3faf5', borderRadius: 13, padding: 12 }, pickupTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: color.green }, pickupCopy: { fontSize: 11, lineHeight: 16, color: color.muted, marginTop: 5 }, bold: { fontWeight: '700' }, mapIllustration: { height: 92, borderRadius: 10, marginTop: 9, overflow: 'hidden' }, mapRoad: { position: 'absolute', width: '140%', height: 44, backgroundColor: '#fff', borderWidth: 1, borderColor: color.line, transform: [{ rotate: '16deg' }], left: '-20%', top: 50 }, mapPin: { position: 'absolute', top: 22, left: '50%', marginLeft: -15, width: 30, height: 30, backgroundColor: '#fff', borderRadius: 15 },
  transportCard: { marginTop: 13, borderWidth: 1, borderColor: '#cfe1d4', backgroundColor: '#f3faf5', borderRadius: 13, padding: 12 }, transportTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, transportTitle: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '700', color: color.green }, transportCopy: { fontSize: 11, lineHeight: 16, color: color.muted, marginTop: 4 }, estimateBadge: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: 99, backgroundColor: '#d8f3dc', fontSize: 9, fontWeight: '800', color: color.green, overflow: 'hidden' },
  addressHeading: { fontSize: 12, lineHeight: 17, fontWeight: '700', color: color.text, marginTop: 12 }, addressRow: { flexDirection: 'row', gap: 9, alignItems: 'stretch' }, addressCell: { flex: 1, minWidth: 0 }, checkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 12, paddingVertical: 5 }, checkbox: { width: 18, height: 18, marginTop: 2, borderWidth: 1, borderColor: '#a7b9ad', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }, checked: { borderColor: color.green, backgroundColor: color.green }, checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' }, checkCopy: { flex: 1, fontSize: 11, lineHeight: 16, color: color.muted },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginVertical: 9 }, summaryLabel: { flex: 1, color: color.muted, fontSize: 12, lineHeight: 17 }, summaryValue: { color: color.muted, fontSize: 12, lineHeight: 17, fontWeight: '600', textAlign: 'right', flexShrink: 1 }, totalRow: { borderTopWidth: 1, borderTopColor: color.line, paddingTop: 11 }, totalLabel: { color: color.text, fontSize: 15, lineHeight: 21, fontWeight: '800' }, totalValue: { color: color.green, fontSize: 15, lineHeight: 21, fontWeight: '800' }, helper: { color: color.muted, fontSize: 10, lineHeight: 15, marginTop: 7 }, dock: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: color.line, backgroundColor: '#fff' },
  errorBanner: { backgroundColor: '#fff1ef', borderWidth: 1, borderColor: '#f4c4bd', padding: 12, borderRadius: 12, marginBottom: 14 }, errorText: { color: color.danger, fontSize: 12, lineHeight: 18, fontWeight: '600' }, missing: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24, backgroundColor: '#fff' }, reviewTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: color.green }, reviewCopy: { color: color.muted, fontSize: 13, lineHeight: 19 }, reviewGroup: { borderTopWidth: 1, borderTopColor: color.line, paddingTop: 12, gap: 5 },
});
