import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getListingImage } from '../data/listingImages';
import { getListingById } from '../data/listings';

const green = '#12372a';
type IconName = React.ComponentProps<typeof SymbolView>['name'];

const icons = {
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
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
      <Text numberOfLines={1} style={styles.specValue}>{value}</Text>
    </View>
  );
}

function unavailable(action: string) {
  Alert.alert(`${action} unavailable`, 'Seller contact and checkout are not connected yet.');
}

export function ListingDetailsScreen({ listingId }: { listingId?: string }) {
  const insets = useSafeAreaInsets();
  const listing = getListingById(listingId ?? '');

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  };

  if (!listing) {
    return (
      <View style={[styles.missing, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <Text style={styles.missingTitle}>Listing not found</Text>
        <Pressable onPress={goBack} accessibilityRole="button">
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
            <Image source={getListingImage(listing.id)} contentFit="cover" style={StyleSheet.absoluteFill} />
            <View style={styles.heroActions}>
              <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.heroButton}>
                <Icon name={icons.back} color="#fff" size={20} />
              </Pressable>
              <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Share listing" hitSlop={8} style={styles.heroButton}>
                <Icon name={icons.share} color="#fff" size={18} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{listing.title}{listing.subtitle ? `\n${listing.subtitle}` : ''}</Text>
            </View>
            <Text style={styles.price}>₱{listing.price.toLocaleString('en-PH')}</Text>
          </View>

          <View style={styles.locationRow}>
            <Icon name={icons.location} color="#718096" size={14} />
            <Text style={styles.location}>{listing.location}</Text>
          </View>

          <View style={styles.thumbnails}>
            <View style={[styles.thumbnail, styles.thumbnailActive]}>
              <Image source={getListingImage(listing.id)} contentFit="cover" style={styles.thumbnailImage} />
            </View>
          </View>

          <View style={styles.specRow}>
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
            <View>
              <Text style={styles.sellerName}>{listing.seller?.name ?? 'Seller profile pending'}</Text>
              <Text style={styles.sellerMeta}>
                {listing.seller ? `Member since ${listing.seller.memberSince}` : 'Seller details not provided'}
              </Text>
              {listing.verified && <Text style={styles.verified}>✓ Verified Seller</Text>}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable onPress={() => unavailable('Calling')} accessibilityRole="button" accessibilityLabel="Call seller" style={styles.callButton}>
          <Icon name={icons.phone} size={20} />
        </Pressable>
        <Pressable onPress={() => unavailable('Chat')} accessibilityRole="button" style={styles.chatButton}>
          <Icon name={icons.chat} color="#fff" size={18} />
          <Text style={styles.chatText}>Chat Seller</Text>
        </Pressable>
        <Pressable onPress={() => unavailable('Ordering')} accessibilityRole="button" style={styles.orderButton}>
          <Icon name={icons.cart} size={18} />
          <Text style={styles.orderText}>Order</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 20 },
  hero: { width: '100%', aspectRatio: 192 / 118, backgroundColor: '#263028' },
  heroActions: { position: 'absolute', top: 12, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  heroButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#26382f', alignItems: 'center', justifyContent: 'center' },
  details: { marginTop: -20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#fff' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  titleBlock: { flex: 1 },
  title: { color: green, fontSize: 20, lineHeight: 23, fontWeight: '800' },
  price: { color: green, fontSize: 21, lineHeight: 25, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  location: { color: '#718096', fontSize: 12, lineHeight: 16 },
  thumbnails: { flexDirection: 'row', gap: 10, marginTop: 17, marginBottom: 16 },
  thumbnail: { width: 52, height: 52, borderRadius: 10, borderWidth: 2, borderColor: 'transparent', backgroundColor: '#f7faf7', overflow: 'hidden' },
  thumbnailImage: { width: '100%', height: '100%' },
  thumbnailActive: { borderColor: green },
  specRow: { flexDirection: 'row', gap: 10 },
  spec: { flex: 1, minWidth: 0, paddingVertical: 10, paddingHorizontal: 4, backgroundColor: '#f7faf7', borderColor: '#e2efe0', borderWidth: 1, borderRadius: 12, alignItems: 'center' },
  specLabel: { color: '#718096', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  specValue: { color: green, fontSize: 12, fontWeight: '700', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#edf2f7', marginVertical: 18 },
  sectionTitle: { color: '#1a202c', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  description: { color: '#4a5568', fontSize: 13, lineHeight: 19.5 },
  healthCard: { minHeight: 92, marginTop: 14, paddingHorizontal: 20, borderWidth: 1, borderColor: '#c7e5c4', borderRadius: 14, backgroundColor: '#e2f3e3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  healthCopy: { flex: 1 },
  healthTitle: { color: green, fontSize: 14, fontWeight: '700' },
  healthSubtitle: { color: '#2d6a4f', fontSize: 11.5, marginTop: 2 },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sellerName: { color: '#1a202c', fontSize: 14, fontWeight: '700' },
  sellerMeta: { color: '#718096', fontSize: 11.5 },
  verified: { color: '#1b4d3e', fontSize: 10, fontWeight: '700', marginTop: 3 },
  dock: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
  callButton: { width: 50, height: 50, borderRadius: 12, borderWidth: 1, borderColor: green, alignItems: 'center', justifyContent: 'center' },
  chatButton: { flex: 1, minWidth: 0, height: 50, borderRadius: 12, backgroundColor: green, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  chatText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  orderButton: { flex: 1, minWidth: 0, height: 50, borderRadius: 12, borderWidth: 1, borderColor: green, backgroundColor: '#e8f3ec', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  orderText: { color: green, fontSize: 14, fontWeight: '700' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#fff' },
  missingTitle: { color: green, fontSize: 20, fontWeight: '700' },
  missingLink: { color: '#296a52', fontSize: 14 },
});
