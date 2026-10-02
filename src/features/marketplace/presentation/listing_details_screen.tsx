import { NavigationIcon } from '@/components/navigation_icon';
import { useState, useSyncExternalStore } from 'react';
import { DataFeedback } from '@/components/data_feedback';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MarketplaceService } from '../application/marketplace_service';
import { formatListingAddress } from '../domain/listing';
import { ListingPhoto } from './listing_photo';

const green = '#12372a';
type IconName = React.ComponentProps<typeof SymbolView>['name'];

const icons = {
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  location: { ios: 'mappin', android: 'location_on', web: 'location_on' },
  shield: { ios: 'shield', android: 'shield', web: 'shield' },
  phone: { ios: 'phone', android: 'call', web: 'call' },
  chat: { ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' },
  cart: { ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' },
} as const;

function Icon({ name, color = green, size = 20 }: { name: IconName; color?: string; size?: number }) {
  return <SymbolView name={name} size={size} tintColor={color} />;
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.spec}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

function unavailable(action: string) {
  Alert.alert(`${action} unavailable`, 'Seller contact is not connected yet.');
}

export function ListingDetailsScreen({
  listingId,
  marketplace,
  onBack,
  onOrder,
  onChat,
  onCall,
  orderEnabled = true,
  orderNotice,
}: {
  listingId?: string;
  marketplace: MarketplaceService;
  onBack: () => void;
  onOrder: (id: string) => void;
  onChat?: () => void;
  onCall?: () => void;
  orderEnabled?: boolean;
  orderNotice?: string;
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const stackTitle = width < 430 || fontScale > 1.15;
  const compact = width < 360 || fontScale > 1.2;
  const data = useSyncExternalStore(marketplace.subscribe, marketplace.getState, marketplace.getState);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const listing = marketplace.getListing(listingId ?? '');

  if (!listing) {
    return (
      <View style={[styles.missing, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <DataFeedback loading={data.loading} error={data.error} onRetry={marketplace.retry} />
        {!data.loading && !data.error && <Text style={styles.missingTitle}>Listing not found</Text>}
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={styles.missingLink}>Back to marketplace</Text>
        </Pressable>
      </View>
    );
  }

  const specs = [
    { label: 'Weight', value: listing.weight },
    { label: 'Age', value: listing.age },
    { label: 'Health', value: listing.health },
  ];
  const photos = listing.imageUris?.length ? listing.imageUris : listing.imageUri ? [listing.imageUri] : [];
  const activePhoto = photos[selectedPhoto] ?? photos[0];
  const imageSource = activePhoto;

  const share = async () => {
    try {
      await Share.share({ message: `${listing.title} — ₱${listing.price.toLocaleString('en-PH')} on AniMarket` });
    } catch {
      Alert.alert('Unable to share', 'Please try again.');
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={{ paddingTop: insets.top, backgroundColor: '#1a1a1a' }}>
          <View style={styles.hero}>
            <ListingPhoto source={imageSource} category={listing.category} label={listing.title} />
            <View style={styles.heroActions}>
              <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.heroButton}>
                <NavigationIcon name="back" color="#fff" />
              </Pressable>
              <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Share listing" hitSlop={8} style={styles.heroButton}>
                <Icon name={icons.share} color="#fff" size={18} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.details}>
          <View style={[styles.titleRow, stackTitle && styles.titleColumn]}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{listing.title}{listing.subtitle ? `\n${listing.subtitle}` : ''}</Text>
            </View>
            <Text style={styles.price}>₱{listing.price.toLocaleString('en-PH')}{listing.priceUnit ? ` ${listing.priceUnit}` : ''}</Text>
          </View>

          <View style={styles.locationRow}>
            <Icon name={icons.location} color="#718096" size={14} />
            <Text style={styles.location}>{formatListingAddress(listing)}</Text>
          </View>

          <View style={styles.thumbnails}>
            {(photos.length ? photos : [null]).map((uri, index) => (
              <Pressable key={`${uri ?? listing.id}-${index}`} accessibilityRole="button" accessibilityLabel={`View photo ${index + 1}`} accessibilityState={{ selected: selectedPhoto === index }} onPress={() => setSelectedPhoto(index)} style={[styles.thumbnail, selectedPhoto === index && styles.thumbnailActive]}>
                <ListingPhoto source={uri} category={listing.category} label={`${listing.title}, photo ${index + 1}`} />
              </Pressable>
            ))}
          </View>

          <View style={[styles.specRow, compact && styles.titleColumn]}>
            {specs.map((spec) => <Spec key={spec.label} {...spec} />)}
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{listing.description}</Text>

          {listing.healthVerification.status === 'verified' && (
            <View style={styles.healthCard}>
              <View style={styles.healthCopy}>
                <Text style={styles.healthTitle}>Verified Health Standard</Text>
                <Text style={styles.healthSubtitle}>{listing.healthVerification.note}</Text>
              </View>
              <Icon name={icons.shield} size={32} />
            </View>
          )}

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Seller Information</Text>
          <View style={styles.sellerCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {listing.seller ? listing.seller.name.split(' ').map((name) => name[0]).slice(0, 2).join('') : '?'}
              </Text>
            </View>
            <View style={styles.sellerCopy}>
              <Text style={styles.sellerName}>{listing.seller?.name ?? 'Seller profile pending'}</Text>
              <Text style={styles.sellerMeta}>
                {listing.seller?.memberSince ? `Member since ${listing.seller.memberSince}` : 'AniMarket seller'}
              </Text>
              {listing.verified && <Text style={styles.verified}>✓ Verified Seller</Text>}
              {orderNotice && <Text style={styles.sellerMeta}>{orderNotice}</Text>}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.dock, compact && styles.dockCompact, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {onCall && <Pressable onPress={onCall} accessibilityRole="button" accessibilityLabel="Call seller" style={styles.callButton}>
          <Icon name={icons.phone} size={20} />
        </Pressable>}
        <Pressable disabled={!onChat} accessibilityState={{ disabled: !onChat }} onPress={onChat ?? (() => unavailable('Chat'))} accessibilityRole="button" style={[styles.chatButton, !onChat && { opacity: 0.5 }]}>
          <Icon name={icons.chat} color="#fff" size={18} />
          <Text style={styles.chatText}>Chat Seller</Text>
        </Pressable>
        <Pressable disabled={!orderEnabled} accessibilityState={{ disabled: !orderEnabled }} onPress={() => onOrder(listing.id)} accessibilityRole="button" style={[styles.orderButton, compact && styles.orderButtonCompact, !orderEnabled && { opacity: 0.5 }]}>
          <Icon name={icons.cart} size={18} />
          <Text style={styles.orderText}>Order</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 20 },
  hero: { width: '100%', aspectRatio: 192 / 118, backgroundColor: '#263028' },
  heroActions: { position: 'absolute', top: 12, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  heroButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#26382f', alignItems: 'center', justifyContent: 'center' },
  details: { marginTop: -20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#fff' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  titleBlock: { flex: 1, minWidth: 0 },
  titleColumn: { flexDirection: 'column' },
  title: { color: green, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  price: { color: green, fontSize: 21, lineHeight: 25, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  location: { flex: 1, minWidth: 0, color: '#52647a', fontSize: 14, lineHeight: 20 },
  thumbnails: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 17, marginBottom: 16 },
  thumbnail: { width: 52, height: 52, borderRadius: 10, borderWidth: 2, borderColor: 'transparent', backgroundColor: '#f7faf7', overflow: 'hidden' },
  thumbnailActive: { borderColor: green },
  specRow: { flexDirection: 'row', gap: 10 },
  spec: { flex: 1, minWidth: 0, paddingVertical: 10, paddingHorizontal: 4, backgroundColor: '#f7faf7', borderColor: '#e2efe0', borderWidth: 1, borderRadius: 12, alignItems: 'center' },
  specLabel: { color: '#52647a', fontSize: 12, lineHeight: 16, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },
  specValue: { color: green, fontSize: 14, lineHeight: 19, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#edf2f7', marginVertical: 18 },
  sectionTitle: { color: '#1a202c', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  description: { color: '#4a5568', fontSize: 14, lineHeight: 21 },
  healthCard: { minHeight: 92, marginTop: 14, paddingHorizontal: 20, borderWidth: 1, borderColor: '#c7e5c4', borderRadius: 14, backgroundColor: '#e2f3e3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  healthCopy: { flex: 1 },
  healthTitle: { color: green, fontSize: 14, fontWeight: '700' },
  healthSubtitle: { color: '#2d6a4f', fontSize: 13, lineHeight: 18, marginTop: 2 },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  sellerCopy: { flex: 1, minWidth: 0 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sellerName: { color: '#1a202c', fontSize: 14, fontWeight: '700' },
  sellerMeta: { color: '#52647a', fontSize: 13, lineHeight: 18 },
  verified: { color: '#1b4d3e', fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 3 },
  dock: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
  dockCompact: { flexWrap: 'wrap' },
  callButton: { width: 50, height: 50, borderRadius: 12, borderWidth: 1, borderColor: green, alignItems: 'center', justifyContent: 'center' },
  chatButton: { flex: 1, minWidth: 0, minHeight: 50, padding: 10, borderRadius: 12, backgroundColor: green, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  chatText: { flexShrink: 1, textAlign: 'center', color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  orderButton: { flex: 1, minWidth: 0, minHeight: 50, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: green, backgroundColor: '#e8f3ec', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  orderButtonCompact: { flexBasis: '100%' },
  orderText: { flexShrink: 1, textAlign: 'center', color: green, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#fff' },
  missingTitle: { color: green, fontSize: 20, fontWeight: '700' },
  missingLink: { color: '#296a52', fontSize: 14 },
});
