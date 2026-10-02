import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { getFirebaseServices } from '@/services/firebase';
import { requireFirebaseUser } from '@/services/firebase_identity';
import { cloudBackendRequest } from '@/services/supabase';
import type { AppRepositories } from './app_repositories';
import type { Listing } from '@/features/marketplace/domain/listing';
import type { OrderRequest } from '@/features/orders/domain/checkout';
import type { NotificationRead } from '@/features/notifications/notification_store';
import type { LocalMarket } from '@/features/market_reference/domain/market_reference';

function owner(scope: string) { if (requireFirebaseUser().uid !== scope) throw new Error('Your account changed. Sign in again.'); }
const uploadedFiles = new Map<string, { uri: string; name: string }>();
async function upload(uri: string, kind: 'listing' | 'vaccination', name = 'photo.jpg') {
  if (/^https:\/\/res\.cloudinary\.com\/dnbmd5qhj\/image\/upload\//.test(uri) || /^private:\/\/vaccination\/[\w-]+$/.test(uri)) return { uri, name };
  const key = `${requireFirebaseUser().uid}:${kind}:${uri}`; const previous = uploadedFiles.get(key); if (previous) return previous;
  if (kind === 'vaccination' && /\.pdf$/i.test(name)) {
    const { Platform } = await import('react-native');
    let photo: string;
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      if (blob.size > 5 * 1024 * 1024) throw new Error('Choose a document smaller than 5 MB.');
      photo = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Unable to read this document.')); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob); });
    } else { const { File } = await import('expo-file-system'); const file = new File(uri); if (file.size > 5 * 1024 * 1024) throw new Error('Choose a document smaller than 5 MB.'); photo = await file.base64(); }
    const result = await cloudBackendRequest<{ uri: string; name: string }>('/uploads', { kind, name, photo }); uploadedFiles.set(key, result); return result;
  }
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const scale = Math.min(1, 1600 / Math.max(original.width, original.height));
  const image = await ImageManipulator.manipulate(original).resize({ width: Math.max(1, Math.round(original.width * scale)), height: Math.max(1, Math.round(original.height * scale)) }).renderAsync();
  const photo = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!photo.base64 || photo.base64.length * 3 / 4 > 5 * 1024 * 1024) throw new Error('Choose a photo smaller than 5 MB.');
  const result = await cloudBackendRequest<{ uri: string; name: string }>('/uploads', { kind, name, photo: photo.base64 }); uploadedFiles.set(key, result); return result;
}
async function prepare(listing: Listing) {
  const images = listing.imageUris ?? (listing.imageUri ? [listing.imageUri] : []);
  // Upload sequentially to bound memory and prevent large parallel mobile requests.
  const imageUris: string[] = []; for (const uri of images) imageUris.push((await upload(uri, 'listing')).uri);
  const proof = listing.vaccinationProof ? await upload(listing.vaccinationProof.uri, 'vaccination', listing.vaccinationProof.name) : undefined;
  return { ...listing, imageUri: imageUris[0], imageUris, vaccinationProof: proof };
}
export function createFirebaseAppRepositories(): AppRepositories {
  const db = () => getFirebaseServices().firestore;
  return {
    listings: {
      watch(scope, receive, fail) { return onSnapshot(query(collection(db(), 'listings'), scope === 'public' ? where('status', '==', 'active') : where('seller.id', '==', scope)), (snapshot) => receive(snapshot.docs.map((item) => item.data() as Listing)), fail); },
      async publish(scope, listing, pickupPin) { owner(scope); const prepared = await prepare(listing); owner(scope); return (await cloudBackendRequest<{ listing: Listing }>('/listings/publish', { listing: prepared, pickupPin })).listing; },
      async save(scope, listing) { owner(scope); return (await cloudBackendRequest<{ listing: Listing }>(`/listings/${listing.id}/save`, { listing })).listing; },
      async remove(scope, id) { owner(scope); await cloudBackendRequest(`/listings/${id}/remove`, {}); },
      async loadPickupPin(id, scope) { owner(scope); return (await cloudBackendRequest<{ pin: { latitude: number; longitude: number } | null }>(`/listings/${id}/pin`)).pin ?? undefined; },
    },
    orders: {
      watch(scope, receive, fail) { owner(scope); return onSnapshot(query(collection(db(), 'orders'), where('participants', 'array-contains', scope)), (snapshot) => receive(snapshot.docs.map((item) => item.data() as OrderRequest & { ownerId: string })), fail); },
      async save(scope, order) { owner(scope); return (await cloudBackendRequest<{ order: OrderRequest & { ownerId: string } }>('/orders/save', { order })).order; },
      async remove() { throw new Error('Orders are retained in your history. Cancel an open request instead.'); },
    },
    markets: {
      watch(_scope, receive, fail) { return onSnapshot(collection(db(), 'marketReferences'), (snapshot) => receive(snapshot.docs.map((item) => item.data() as LocalMarket)), fail); },
      async save() { throw new Error('Market references are maintained by the project owner.'); },
      async remove() { throw new Error('Market references are maintained by the project owner.'); },
    },
    notificationReads: {
      watch(scope, receive, fail) { owner(scope); return onSnapshot(collection(db(), 'users', scope, 'notificationReads'), (snapshot) => receive(snapshot.docs.map((item) => item.data() as NotificationRead)), fail); },
      async save(scope, item) { owner(scope); await setDoc(doc(db(), 'users', scope, 'notificationReads', item.id), item); owner(scope); return item; },
      async remove() { throw new Error('Read notification history cannot be removed.'); },
    },
  };
}
