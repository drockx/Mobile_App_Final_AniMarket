import { useRef, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getListingImage } from '@/features/marketplace/presentation/listing_images';

import type { CheckoutService } from '../application/checkout_service';
import { checkoutTotals, DELIVERY_PROVINCES, emptyCheckoutForm, PICKUP_TIMES, validateCheckout, type CheckoutForm, type CheckoutItem } from '../domain/checkout';
import { CheckoutButton, checkoutColors as color, CheckoutDate, CheckoutField, checkoutIcons as icons, CheckoutSelect, FieldError } from './checkout_controls';
import { amountRange, money, OrderNotice as Notice, OrderSteps, OrderSummaryRow as SummaryRow } from './order_components';

const paymentOptions = [{ value: 'cod', label: 'Pay upon meetup / delivery' }, { value: 'seller', label: 'Coordinate payment with seller' }] as const;
export function OrderCheckoutScreen({ item, service, receiverName = '', receiverPhone = '', onBack, onReview }: {
  item?: CheckoutItem; service: CheckoutService; receiverName?: string; receiverPhone?: string; onBack: () => void; onReview: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.25;
  const stackPrice = width < 420 || fontScale > 1.15;
  const stackAddress = width < 400 || fontScale > 1.15;
  const scroll = useRef<ScrollView>(null);
  const [form, setForm] = useState<CheckoutForm>(() => (item && service.getForm(item.id)) || emptyCheckoutForm(receiverName, receiverPhone));
  const [attempted, setAttempted] = useState(false);
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
    if (result.draft) { onReview(item.id); return; }
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
        <OrderSteps current={0} />
        {Object.keys(errors).length > 0 && <View style={styles.errorBanner}><Text accessibilityRole="alert" style={styles.errorText}>Please complete the required details below.</Text><FieldError message={errors.listing} /></View>}
        <View style={[styles.card, styles.product]}>
          <LinearGradient colors={['#d8f3dc', '#95d5b2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumbnail}>{image && <Image source={image} contentFit="cover" accessibilityLabel={item.title} style={StyleSheet.absoluteFill} />}</LinearGradient>
          <View style={styles.productCopy}>
            <Text style={styles.productTitle}>{item.title}</Text><Text style={styles.productMeta}>{item.weight} • {item.health}</Text><Text style={styles.productMeta}>Seller: {item.seller}</Text>
            {stackPrice && <View style={styles.inlinePrice}><Text style={styles.productPrice}>{money(item.price)}</Text>{item.priceUnit && <Text style={styles.priceUnit}>{item.priceUnit}</Text>}</View>}
          </View>
          {!stackPrice && <View style={styles.priceBlock}><Text style={styles.productPrice}>{money(item.price)}</Text>{item.priceUnit && <Text style={styles.priceUnit}>{item.priceUnit}</Text>}</View>}
        </View>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>How will you receive the livestock?</Text>
          <View style={[styles.choices, compact && styles.column]}>
            {([{ value: 'pickup', title: 'Pickup', icon: icons.pin, description: 'Meet the seller at the listed farm or agreed pickup point.' }, { value: 'delivery', title: 'Delivery', icon: icons.truck, description: 'Arrange livestock transport and provide a destination address.' }] as const).map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={`${option.title}. ${option.description}`} accessibilityState={{ checked: form.fulfillment === option.value }} onPress={() => changeMode(option.value)} style={[styles.choice, compact && styles.stackedCell, form.fulfillment === option.value && styles.choiceSelected]}>
              <View style={styles.choiceTop}><SymbolView name={option.icon} size={26} tintColor={color.green} /><View style={[styles.radio, form.fulfillment === option.value && styles.radioSelected]}>{form.fulfillment === option.value && <View style={styles.radioDot} />}</View></View>
              <Text style={styles.choiceTitle}>{option.title}</Text><Text style={styles.choiceDescription}>{option.description}</Text>
            </Pressable>)}
          </View>
          <Notice>Delivery is optional. The buyer and seller must confirm animal readiness, vehicle suitability, permits, fees, and the final schedule before transport.</Notice>
          {delivery ? <>
            <View style={styles.transportCard}>
              <View style={[styles.transportTop, compact && styles.column]}><Text style={[styles.transportTitle, compact && styles.stackedCell]}>Davao Livestock Transport Cooperative</Text><Text style={styles.estimateBadge}>Estimate</Text></View>
              <Text style={styles.transportCopy}>Livestock-ready truck • Ventilated partitions • Driver contact shared after seller confirmation</Text>
              <SummaryRow label="Estimated transport fee" value="₱2,500–₱3,500" total />
            </View>
            <CheckoutDate label="Preferred delivery date" value={form.deliveryDate} onSelect={(value) => update('deliveryDate', value)} error={errors.deliveryDate} />
            <CheckoutField label="Receiver name" required value={form.receiver} onChangeText={(value) => update('receiver', value)} placeholder="Full name" autoComplete="name" error={errors.receiver} />
            <CheckoutField label="Receiver phone" required value={form.phone} onChangeText={(value) => update('phone', value)} placeholder="09XX XXX XXXX" keyboardType="phone-pad" autoComplete="tel" maxLength={20} error={errors.phone} />
            <Text style={styles.addressHeading}>Delivery address</Text>
            <View style={[styles.addressRow, stackAddress && styles.addressColumn]}>
              <View style={[styles.addressCell, stackAddress && styles.stackedCell]}><CheckoutField label="Purok/Street" required value={form.street} onChangeText={(value) => update('street', value)} placeholder="Purok 2" error={errors.street} /></View>
              <View style={[styles.addressCell, stackAddress && styles.stackedCell]}><CheckoutField label="Barangay" required value={form.barangay} onChangeText={(value) => update('barangay', value)} placeholder="Barangay name" error={errors.barangay} /></View>
            </View>
            <View style={[styles.addressRow, stackAddress && styles.addressColumn]}>
              <View style={[styles.addressCell, stackAddress && styles.stackedCell]}><CheckoutField label="Municipality/City" required value={form.city} onChangeText={(value) => update('city', value)} placeholder="Tagum City" error={errors.city} /></View>
              <View style={[styles.addressCell, stackAddress && styles.stackedCell]}><CheckoutSelect label="Province" required value={form.province} onSelect={(value) => update('province', value)} options={DELIVERY_PROVINCES.map((province) => ({ label: province, value: province }))} placeholder="Select province" error={errors.province} /></View>
            </View>
            <View style={[styles.addressRow, stackAddress && styles.addressColumn]}>
              <View style={[styles.addressCell, stackAddress && styles.stackedCell]}><CheckoutField label="Postal code" required value={form.postal} onChangeText={(value) => update('postal', value.replace(/\D/g, ''))} placeholder="8100" keyboardType="number-pad" maxLength={4} error={errors.postal} /></View>
              <View style={[styles.addressCell, stackAddress && styles.stackedCell]}><CheckoutField label="Landmark" value={form.landmark} onChangeText={(value) => update('landmark', value)} placeholder="Optional" /></View>
            </View>
            <CheckoutField label="Transport instructions" value={form.notes} onChangeText={(value) => update('notes', value)} placeholder="Gate access, unloading area, handling notes" multiline maxLength={1000} />
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.accessibleDestination }} accessibilityLabel="I confirm that a livestock transport vehicle can safely access the destination and that an adult receiver will be present" onPress={() => update('accessibleDestination', !form.accessibleDestination)} style={styles.checkRow}>
              <View style={[styles.checkbox, form.accessibleDestination && styles.checked]}>{form.accessibleDestination && <Text allowFontScaling={false} style={styles.checkmark}>✓</Text>}</View><Text style={styles.checkCopy}>I confirm that a livestock transport vehicle can safely access the destination and that an adult receiver will be present.</Text>
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
    </KeyboardAvoidingView>
  </View>;
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#eef3ef' },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: color.line },
  back: { width: 44, minHeight: 58, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, minWidth: 0, paddingVertical: 12, textAlign: 'center', fontSize: 24, lineHeight: 30, fontWeight: '700', color: color.green },
  content: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 8 },
  card: { borderWidth: 1, borderColor: color.line, borderRadius: 16, padding: 14, marginBottom: 14, backgroundColor: '#fff' },
  product: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  thumbnail: { width: 68, height: 68, flexShrink: 0, borderRadius: 13, overflow: 'hidden' },
  productCopy: { flex: 1, minWidth: 0 },
  productTitle: { fontSize: 15, lineHeight: 19, fontWeight: '800', color: color.text, marginBottom: 3 },
  productMeta: { fontSize: 13, lineHeight: 18, color: color.muted, marginTop: 2 },
  priceBlock: { alignItems: 'flex-end', maxWidth: 112, flexShrink: 0 },
  inlinePrice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6, marginTop: 6 },
  productPrice: { fontSize: 16, lineHeight: 20, fontWeight: '800', color: color.green },
  priceUnit: { fontSize: 13, lineHeight: 18, color: color.muted },
  sectionTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: color.green, marginBottom: 12 },
  choices: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  column: { flexDirection: 'column' },
  stackedCell: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  choice: { flex: 1, minWidth: 0, minHeight: 128, borderWidth: 1.5, borderColor: color.line, borderRadius: 14, padding: 12 },
  choiceSelected: { borderColor: color.green, backgroundColor: color.mint },
  choiceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choiceTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: color.green, marginTop: 8, marginBottom: 4 },
  choiceDescription: { fontSize: 13, lineHeight: 18, color: color.muted },
  radio: { width: 20, height: 20, borderWidth: 1, borderColor: '#a7b9ad', borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: color.green },
  radioDot: { width: 10, height: 10, backgroundColor: color.green, borderRadius: 5 },
  pickupBox: { marginTop: 12, borderWidth: 1, borderColor: '#cfe1d4', backgroundColor: '#f3faf5', borderRadius: 13, padding: 12 },
  pickupTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: color.green },
  pickupCopy: { fontSize: 13, lineHeight: 18, color: color.muted, marginTop: 6 },
  bold: { fontWeight: '700' },
  mapIllustration: { height: 92, borderRadius: 10, marginTop: 12, overflow: 'hidden' },
  mapRoad: { position: 'absolute', width: '140%', height: 44, backgroundColor: '#fff', borderWidth: 1, borderColor: color.line, transform: [{ rotate: '16deg' }], left: '-20%', top: 50 },
  mapPin: { position: 'absolute', top: 22, left: '50%', marginLeft: -15, width: 30, height: 30, backgroundColor: '#fff', borderRadius: 15 },
  transportCard: { marginTop: 12, borderWidth: 1, borderColor: '#cfe1d4', backgroundColor: '#f3faf5', borderRadius: 13, padding: 12 },
  transportTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  transportTitle: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, fontWeight: '700', color: color.green },
  transportCopy: { fontSize: 13, lineHeight: 18, color: color.muted, marginTop: 6 },
  estimateBadge: { flexShrink: 0, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#d8f3dc', fontSize: 12, lineHeight: 16, fontWeight: '700', color: color.green },
  addressHeading: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: color.text, marginTop: 16 },
  addressRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  addressColumn: { flexDirection: 'column', gap: 0 },
  addressCell: { flex: 1, minWidth: 0 },
  checkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12, paddingVertical: 6 },
  checkbox: { width: 22, height: 22, flexShrink: 0, borderWidth: 1, borderColor: '#a7b9ad', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checked: { borderColor: color.green, backgroundColor: color.green },
  checkmark: { color: '#fff', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  checkCopy: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, color: color.muted },
  helper: { color: color.muted, fontSize: 13, lineHeight: 18, marginTop: 8 },
  dock: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: color.line, backgroundColor: '#fff' },
  errorBanner: { backgroundColor: '#fff1ef', borderWidth: 1, borderColor: '#f4c4bd', padding: 12, borderRadius: 12, marginBottom: 14 },
  errorText: { color: color.danger, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  missing: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24, backgroundColor: '#fff' },
  reviewTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: color.green },
  reviewCopy: { color: color.muted, fontSize: 13, lineHeight: 18 },
});
