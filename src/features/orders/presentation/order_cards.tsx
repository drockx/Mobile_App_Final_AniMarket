import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { animalIcons } from '@/constants/animal_icons';
import { getListingImage } from '@/features/marketplace/presentation/listing_images';

import type { CheckoutItem } from '../domain/checkout';
import { checkoutColors as color, checkoutIcons as icons } from './checkout_controls';
import { money } from './order_components';

export function OrderBadge({ label, pending = false }: { label: string; pending?: boolean }) {
  return <Text style={[styles.badge, pending && styles.pendingBadge]}>{label}</Text>;
}

export function OrderCard({ title, meta, action, onAction, children }: {
  title: string; meta?: string; action?: string; onAction?: () => void; children: ReactNode;
}) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.15;
  return <View style={styles.card}>
    <View style={[styles.sectionHead, compact && styles.column]}>
      <View style={[styles.headingCopy, compact && styles.noFlex]}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{meta && <Text style={styles.meta}>{meta}</Text>}</View>
      {action && onAction && <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} onPress={onAction} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}><Text style={styles.editText}>{action}</Text></Pressable>}
    </View>
    {children}
  </View>;
}

export function OrderConfirmation({ title, description, status, ready = false }: { title: string; description: string; status: string; ready?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.15;
  return <View style={styles.confirmation}>
    <View style={[styles.checkIcon, !ready && styles.pendingIcon]}><SymbolView name={ready ? icons.check : icons.info} size={16} tintColor={ready ? color.green : '#895000'} /></View>
    <View style={styles.confirmationCopy}><Text style={styles.confirmationTitle}>{title}</Text><Text style={styles.body}>{description}</Text>{compact && <View style={styles.inlineBadge}><OrderBadge label={status} pending={!ready} /></View>}</View>
    {!compact && <OrderBadge label={status} pending={!ready} />}
  </View>;
}

export function OrderItem({ item }: { item: CheckoutItem }) {
  const { width, fontScale } = useWindowDimensions();
  const stackPrice = width < 420 || fontScale > 1.15;
  const image = item.imageUri ? { uri: item.imageUri } : getListingImage(item.id);
  const animal = item.category === 'Goat' ? animalIcons.goat : item.category === 'Pig' ? animalIcons.pig : item.category === 'Chicken' ? animalIcons.poultry : animalIcons.cow;
  return <>
    <View style={styles.product}>
      <LinearGradient colors={['#d8f3dc', '#95d5b2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumbnail}>
        {image ? <Image source={image} contentFit="cover" accessibilityLabel={item.title} style={StyleSheet.absoluteFill} /> : <Text accessible={false} allowFontScaling={false} style={styles.animal}>{animal}</Text>}
      </LinearGradient>
      <View style={styles.productCopy}>
        <Text style={styles.productTitle}>{item.title}</Text><Text style={styles.body}>{item.weight} • {item.health}</Text><Text style={styles.body}>Seller: {item.seller}</Text>
        {stackPrice && <View style={styles.inlinePrice}><Text style={styles.productPrice}>{money(item.price)}</Text>{item.priceUnit && <Text style={styles.body}>{item.priceUnit}</Text>}</View>}
      </View>
      {!stackPrice && <View style={styles.priceBlock}><Text style={styles.productPrice}>{money(item.price)}</Text>{item.priceUnit && <Text style={styles.priceUnit}>{item.priceUnit}</Text>}</View>}
    </View>
    <View style={styles.chips}>
      <OrderBadge label={item.vaccinationProofName ? 'Vaccination proof attached' : item.healthVerified ? 'Health records noted' : 'Health records to confirm'} pending={!item.vaccinationProofName && !item.healthVerified} />
      <OrderBadge label={item.verified ? 'Verified seller' : 'Seller verification to confirm'} pending={!item.verified} />
      <OrderBadge label="Availability to confirm" pending />
    </View>
  </>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: color.line, borderRadius: 16, padding: 14, marginBottom: 14, backgroundColor: '#fff' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  noFlex: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  headingCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: color.green },
  meta: { color: color.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  edit: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', alignSelf: 'flex-end' },
  editText: { color: color.mid, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  badge: { alignSelf: 'flex-start', flexShrink: 1, maxWidth: '100%', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: color.mint, color: color.green, fontSize: 12, lineHeight: 16, fontWeight: '700', overflow: 'hidden' },
  pendingBadge: { color: '#895000', backgroundColor: color.warn },
  body: { color: color.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  confirmation: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  checkIcon: { width: 28, height: 28, flexShrink: 0, borderRadius: 7, backgroundColor: color.mint, alignItems: 'center', justifyContent: 'center' },
  pendingIcon: { backgroundColor: color.warn },
  confirmationCopy: { flex: 1, minWidth: 0 },
  confirmationTitle: { color: color.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  inlineBadge: { marginTop: 6 },
  product: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  thumbnail: { width: 68, height: 68, flexShrink: 0, borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  animal: { fontSize: 36, lineHeight: 44 },
  productCopy: { flex: 1, minWidth: 0 },
  productTitle: { color: color.text, fontSize: 15, lineHeight: 19, fontWeight: '800', marginBottom: 3 },
  productPrice: { color: color.green, fontSize: 16, lineHeight: 20, fontWeight: '800' },
  priceBlock: { alignItems: 'flex-end', maxWidth: 112, flexShrink: 0 },
  inlinePrice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6, marginTop: 6 },
  priceUnit: { color: color.muted, fontSize: 13, lineHeight: 18, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
});
