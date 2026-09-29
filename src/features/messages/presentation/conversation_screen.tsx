import { useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Conversation } from '../domain/conversation';

const forest = '#12372a';
const green = '#2d6a4f';
const muted = '#6c7771';
const line = '#dfe8e2';
const isJuan = (conversation: Conversation) => conversation.id === 'juan-brahman';

const icons = {
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  phone: { ios: 'phone', android: 'call', web: 'call' },
  more: { ios: 'ellipsis', android: 'more_vert', web: 'more_vert' },
  attach: { ios: 'paperclip', android: 'attach_file', web: 'attach_file' },
  camera: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  send: { ios: 'paperplane.fill', android: 'send', web: 'send' },
} as const;

type IconName = React.ComponentProps<typeof SymbolView>['name'];
type ChatMessage = { id: string; text: string; imageUri?: string; mine: boolean; time: string };
type OfferStatus = 'pending' | 'accepted' | 'declined';
const sessionMessages = new Map<string, ChatMessage[]>();

function Icon({ name, size = 20, color = forest }: { name: IconName; size?: number; color?: string }) {
  return <SymbolView name={name} size={size} tintColor={color} />;
}

function initialMessages(conversation: Conversation): ChatMessage[] {
  if (!isJuan(conversation)) {
    return [{ id: 'initial', text: conversation.preview, mine: false, time: conversation.time }];
  }
  return [
    { id: 'hello', text: 'Good morning! The Brahman bull is available. It is vaccinated, and the proof is attached to the listing.', mine: false, time: '10:01 AM' },
    { id: 'question', text: 'Great! Can we confirm the live-weight price?', mine: true, time: '10:03 AM · Read' },
    { id: 'price', text: 'The current price is ₱100 per kg based on its 450 kg live weight.', mine: false, time: '10:05 AM' },
    { id: 'delivery', text: 'I can arrange delivery to Tagum City. I’ll confirm the address during checkout.', mine: true, time: '10:08 AM · Read' },
  ];
}

function MessageBubble({ message, initials }: { message: ChatMessage; initials: string }) {
  return (
    <View style={[styles.messageRow, message.mine && styles.myRow]}>
      {!message.mine && <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{initials}</Text></View>}
      <View style={styles.messageWrap}>
        <View style={[styles.bubble, message.mine && styles.myBubble]}>
          {message.imageUri && <Image accessibilityLabel="Conversation photo" source={{ uri: message.imageUri }} contentFit="cover" style={styles.chatImage} />}
          {!!message.text && <Text style={[styles.bubbleText, message.mine && styles.myBubbleText, message.imageUri && styles.imageCaption]}>{message.text}</Text>}
        </View>
        <Text style={[styles.messageTime, message.mine && styles.myTime]}>{message.time}</Text>
      </View>
    </View>
  );
}

function OfferDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.offerDetail}>
      <Text style={styles.offerDetailLabel}>{label}</Text>
      <Text style={styles.offerDetailValue}>{value}</Text>
    </View>
  );
}

export function ConversationScreen({ conversation, onBack }: { conversation?: Conversation; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollAfterMessage = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => conversation ? sessionMessages.get(conversation.id) ?? initialMessages(conversation) : []);
  const [draft, setDraft] = useState('');
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [offerStatus, setOfferStatus] = useState<OfferStatus>('pending');
  const [offerPrice, setOfferPrice] = useState(98);
  const [counterDraft, setCounterDraft] = useState('99');
  const [counterOpen, setCounterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [counterError, setCounterError] = useState('');

  if (!conversation) {
    return (
      <View style={[styles.missing, { paddingTop: insets.top + 24 }]}>
        <StatusBar style="dark" />
        <Text style={styles.missingTitle}>Conversation not found</Text>
        <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.backLink}>Back to messages</Text></Pressable>
      </View>
    );
  }

  const addLocalMessage = (text: string, imageUri?: string) => {
    scrollAfterMessage.current = true;
    const current = sessionMessages.get(conversation.id) ?? messages;
    const next = [...current, { id: `${Date.now()}-${current.length}`, text, imageUri, mine: true, time: 'Just now · On this device' }];
    sessionMessages.set(conversation.id, next);
    setMessages(next);
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    addLocalMessage(text);
    setDraft('');
  };

  const attachDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: false });
      if (!result.canceled) setNotice(`${result.assets[0].name} selected. Sending files requires a connected messaging service.`);
    } catch {
      setNotice('Unable to select document. Please try again.');
    }
  };

  const attachPhoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setNotice('Camera permission is required to take a photo.');
          return;
        }
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false });
      if (!result.canceled && result.assets[0]?.uri) setCapturedPhotoUri(result.assets[0].uri);
    } catch {
      setNotice('Unable to open the camera. Check that a camera is available and try again.');
    }
  };

  const sendCapturedPhoto = () => {
    if (!capturedPhotoUri) return;
    addLocalMessage('', capturedPhotoUri);
    setCapturedPhotoUri(null);
  };

  const submitCounter = () => {
    const price = Number(counterDraft);
    if (!Number.isFinite(price) || price <= 0) {
      setCounterError('Enter a price greater than zero.');
      return;
    }
    setOfferPrice(price);
    setCounterError('');
    setCounterOpen(false);
    setNotice('Counteroffer updated on this device. Sending offers requires a connected messaging service.');
  };

  return (
    <KeyboardAvoidingView style={styles.background} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to messages" hitSlop={8} onPress={onBack} style={styles.iconButton}>
            <Icon name={icons.back} />
          </Pressable>
          <View style={styles.person}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{conversation.initials}</Text></View>
            <View style={styles.personCopy}>
              <Text numberOfLines={1} style={styles.personName}>{conversation.participant}</Text>
              <Text style={styles.personStatus}>{conversation.verifiedSeller ? 'Verified seller' : conversation.side === 'selling' ? 'Buyer' : 'Seller'}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Call seller" hitSlop={8} onPress={() => setNotice('Phone contact is not connected yet.')} style={styles.iconButton}>
            <Icon name={icons.phone} size={19} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Conversation options" hitSlop={8} onPress={() => setMenuOpen((open) => !open)} style={styles.iconButton}>
            <Icon name={icons.more} size={19} />
          </Pressable>
          {menuOpen && (
            <View style={styles.menu}>
              <Pressable accessibilityRole="button" onPress={() => { setMenuOpen(false); setNotice('Profiles are not connected to conversations yet.'); }} style={styles.menuItem}>
                <Text style={styles.menuText}>View profile</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setMenuOpen(false); setNotice('Reporting is not connected yet.'); }} style={styles.menuItem}>
                <Text style={styles.menuText}>Report conversation</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.listingBanner}>
          <View style={styles.animal}><Text style={styles.animalText}>🐄</Text></View>
          <View style={styles.listingCopy}>
            <Text numberOfLines={1} style={styles.listingTitle}>{conversation.listing}</Text>
            <Text numberOfLines={1} style={styles.listingMeta}>{isJuan(conversation) ? '450 kg · Listed at ₱45,000 · Tagum City' : 'Livestock listing'}</Text>
          </View>
        </View>

        {!!notice && (
          <View accessibilityLiveRegion="polite" style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notice" onPress={() => setNotice('')} style={styles.noticeClose}><Text style={styles.noticeCloseText}>×</Text></Pressable>
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.chat}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (scrollAfterMessage.current) {
              scrollAfterMessage.current = false;
              scrollRef.current?.scrollToEnd({ animated: true });
            }
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.date}>{isJuan(conversation) ? 'TODAY, SEPTEMBER 21' : 'CONVERSATION'}</Text>
          {messages.map((message) => (
            <View key={message.id}>
              {message.id === 'delivery' && isJuan(conversation) && (
                <View style={styles.offerPlacement}>
                  {offerStatus === 'pending' ? (
                    <View style={styles.offerCard}>
                      <View style={styles.offerHeader}>
                        <Text style={styles.offerEyebrow}>PROPOSED LIVESTOCK PRICE</Text>
                        <Text style={styles.offerPrice}>₱{offerPrice.toLocaleString('en-PH')} / kg</Text>
                        <Text style={styles.offerSubtitle}>Buyer’s counteroffer</Text>
                      </View>
                      <View style={styles.offerBody}>
                        <View style={styles.offerGrid}>
                          <OfferDetail label="Live weight" value="450 kg" />
                          <OfferDetail label="Quantity" value="1 head" />
                          <OfferDetail label="Pickup or Delivery" value="Delivery" />
                          <OfferDetail label="Offer expires" value="Sep 22, 6 PM" />
                        </View>
                        <View style={styles.totalRow}>
                          <Text style={styles.totalLabel}>Estimated livestock total</Text>
                          <Text style={styles.totalValue}>₱{(offerPrice * 450).toLocaleString('en-PH')}</Text>
                        </View>
                        <Text style={styles.offerNote}>The final total may change if the verified live weight changes. Delivery fees are added during order checkout.</Text>
                      </View>
                      <View style={styles.offerActions}>
                        <Pressable accessibilityRole="button" onPress={() => setOfferStatus('declined')} style={[styles.offerAction, styles.declineButton]}><Text style={styles.declineText}>Decline</Text></Pressable>
                        <Pressable accessibilityRole="button" onPress={() => { setCounterError(''); setCounterOpen(true); }} style={[styles.offerAction, styles.counterButton]}><Text style={styles.counterText}>Counter</Text></Pressable>
                        <Pressable accessibilityRole="button" onPress={() => setOfferStatus('accepted')} style={[styles.offerAction, styles.acceptButton]}><Text style={styles.acceptText}>Accept Price</Text></Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.offerResult}>
                      <Text style={styles.offerResultTitle}>{offerStatus === 'accepted' ? 'Price agreement recorded on this device' : 'Offer declined on this device'}</Text>
                      <Text style={styles.offerResultText}>{offerStatus === 'accepted' ? `₱${offerPrice}/kg for an estimated 450 kg. Checkout is not connected yet.` : 'No order has been created.'}</Text>
                    </View>
                  )}
                </View>
              )}
              <MessageBubble message={message} initials={conversation.initials} />
            </View>
          ))}
          {isJuan(conversation) && <Text style={styles.systemNote}>Price agreement does not mark the livestock as sold.</Text>}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Attach document" hitSlop={6} onPress={attachDocument} style={styles.composerIcon}><Icon name={icons.attach} size={21} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Take photo" hitSlop={6} onPress={attachPhoto} style={styles.composerIcon}><Icon name={icons.camera} size={21} /></Pressable>
          <TextInput accessibilityLabel="Message" multiline onChangeText={setDraft} placeholder="Write a message..." placeholderTextColor={muted} style={styles.messageInput} value={draft} />
          <Pressable accessibilityRole="button" accessibilityLabel="Send message on this device" accessibilityState={{ disabled: !draft.trim() }} disabled={!draft.trim()} onPress={send} style={[styles.sendButton, !draft.trim() && styles.sendDisabled]}><Icon name={icons.send} size={18} color="#fff" /></Pressable>
        </View>
      </View>

      <Modal visible={counterOpen} transparent animationType="fade" onRequestClose={() => setCounterOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Send a counteroffer</Text>
            <Text style={styles.modalDescription}>Enter a price per kilogram. The estimated total uses the listed 450 kg live weight.</Text>
            <Text style={styles.modalLabel}>Price per kg (₱)</Text>
            <TextInput accessibilityLabel="Price per kilogram" keyboardType="decimal-pad" onChangeText={setCounterDraft} style={styles.modalInput} value={counterDraft} />
            {!!counterError && <Text style={styles.modalError}>{counterError}</Text>}
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={() => setCounterOpen(false)} style={[styles.modalButton, styles.modalCancel]}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={submitCounter} style={[styles.modalButton, styles.modalSave]}><Text style={styles.modalSaveText}>Update price</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={capturedPhotoUri !== null} animationType="slide" onRequestClose={() => setCapturedPhotoUri(null)}>
        <View style={[styles.photoReview, { paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <StatusBar style="light" />
          <Text style={styles.photoReviewTitle}>Send photo to {conversation.participant}?</Text>
          <Text style={styles.photoReviewNote}>This conversation is stored on this device only.</Text>
          <View style={styles.photoReviewMedia}>
            {capturedPhotoUri && <Image accessibilityLabel="Captured photo preview" source={{ uri: capturedPhotoUri }} contentFit="contain" style={styles.photoReviewImage} />}
          </View>
          <View style={styles.photoReviewActions}>
            <Pressable accessibilityRole="button" onPress={() => setCapturedPhotoUri(null)} style={[styles.photoReviewButton, styles.photoCancel]}><Text style={styles.photoCancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={sendCapturedPhoto} style={[styles.photoReviewButton, styles.photoSend]}><Text style={styles.photoSendText}>Send photo</Text></Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  missing: { flex: 1, alignItems: 'center', backgroundColor: '#fff' },
  missingTitle: { color: forest, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  backLink: { color: green, fontSize: 15, fontWeight: '700' },
  header: { minHeight: 64, paddingHorizontal: 10, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: line, zIndex: 2 },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  person: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d8eddd' },
  avatarText: { color: forest, fontSize: 10, fontWeight: '800' },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { color: forest, fontSize: 14, fontWeight: '700' },
  personStatus: { color: '#27935b', fontSize: 11, marginTop: 2 },
  menu: { position: 'absolute', top: '100%', right: 10, width: 190, padding: 5, borderWidth: 1, borderColor: line, borderRadius: 11, backgroundColor: '#fff', elevation: 6, shadowColor: forest, shadowOpacity: 0.18, shadowRadius: 12 },
  menuItem: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 10 },
  menuText: { color: forest, fontSize: 13 },
  listingBanner: { minHeight: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: line, backgroundColor: '#f4fbf6' },
  animal: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d8eddd' },
  animalText: { fontSize: 22 },
  listingCopy: { flex: 1, minWidth: 0 },
  listingTitle: { color: forest, fontSize: 12, fontWeight: '700' },
  listingMeta: { color: muted, fontSize: 10, marginTop: 3 },
  notice: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 6, paddingVertical: 5, backgroundColor: '#fff7df' },
  noticeText: { flex: 1, color: '#795400', fontSize: 11, lineHeight: 15 },
  noticeClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  noticeCloseText: { color: '#795400', fontSize: 22 },
  chat: { paddingHorizontal: 15, paddingTop: 12, paddingBottom: 20, gap: 10 },
  date: { color: muted, fontSize: 10, textAlign: 'center', marginBottom: 3 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  myRow: { justifyContent: 'flex-end' },
  smallAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: forest },
  smallAvatarText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  messageWrap: { maxWidth: '78%' },
  bubble: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, borderBottomLeftRadius: 4, backgroundColor: '#f0f3f1' },
  myBubble: { borderBottomLeftRadius: 13, borderBottomRightRadius: 4, backgroundColor: forest },
  bubbleText: { color: '#17221d', fontSize: 13, lineHeight: 18 },
  myBubbleText: { color: '#fff' },
  chatImage: { width: 190, height: 140, borderRadius: 8 },
  imageCaption: { marginTop: 6 },
  messageTime: { color: muted, fontSize: 10, marginHorizontal: 4, marginTop: 4 },
  myTime: { textAlign: 'right' },
  offerPlacement: { marginHorizontal: 22, marginBottom: 10 },
  offerCard: { borderWidth: 1, borderColor: '#b7d3bf', borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff' },
  offerHeader: { paddingHorizontal: 13, paddingVertical: 11, backgroundColor: forest },
  offerEyebrow: { color: '#c5dfd0', fontSize: 9, letterSpacing: 0.5, fontWeight: '800' },
  offerPrice: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 3 },
  offerSubtitle: { color: '#e2eee6', fontSize: 10, marginTop: 2 },
  offerBody: { paddingHorizontal: 12, paddingTop: 10 },
  offerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  offerDetail: { width: '48.5%', minHeight: 48, padding: 7, borderRadius: 8, backgroundColor: '#f6f9f7' },
  offerDetailLabel: { color: muted, fontSize: 10 },
  offerDetailValue: { color: '#17221d', fontSize: 11, fontWeight: '700', marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4, marginTop: 10 },
  totalLabel: { color: muted, fontSize: 10, flexShrink: 1 },
  totalValue: { color: forest, fontSize: 15, fontWeight: '800' },
  offerNote: { color: muted, fontSize: 10, lineHeight: 14, marginTop: 8, marginBottom: 10 },
  offerActions: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
  offerAction: { flex: 1, minHeight: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  declineButton: { borderWidth: 1, borderColor: '#e5c7c4' },
  counterButton: { borderWidth: 1, borderColor: forest },
  acceptButton: { backgroundColor: forest },
  declineText: { color: '#a33b34', fontSize: 10, fontWeight: '800' },
  counterText: { color: forest, fontSize: 10, fontWeight: '800' },
  acceptText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  offerResult: { padding: 13, borderWidth: 1, borderColor: '#b7d3bf', borderRadius: 13, backgroundColor: '#eaf5ed' },
  offerResultTitle: { color: forest, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  offerResultText: { color: muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  systemNote: { alignSelf: 'center', overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, color: '#8a5c00', backgroundColor: '#fff7df', fontSize: 10, textAlign: 'center' },
  composer: { minHeight: 58, paddingTop: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 5, borderTopWidth: 1, borderTopColor: line, backgroundColor: '#fff' },
  composerIcon: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  messageInput: { flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: line, borderRadius: 20, color: '#17221d', fontSize: 13 },
  sendButton: { width: 40, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: forest },
  sendDisabled: { opacity: 0.55 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#12372a72' },
  modalCard: { width: '100%', maxWidth: 390, alignSelf: 'center', padding: 20, borderRadius: 17, backgroundColor: '#fff' },
  modalTitle: { color: forest, fontSize: 19, fontWeight: '700' },
  modalDescription: { color: muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  modalLabel: { color: forest, fontSize: 12, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  modalInput: { height: 44, paddingHorizontal: 11, borderWidth: 1, borderColor: line, borderRadius: 9, color: '#17221d', fontSize: 15 },
  modalError: { color: '#a33b34', fontSize: 12, marginTop: 6 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  modalButton: { flex: 1, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  modalCancel: { borderWidth: 1, borderColor: line },
  modalSave: { backgroundColor: forest },
  modalCancelText: { color: forest, fontSize: 13, fontWeight: '700' },
  modalSaveText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  photoReview: { flex: 1, paddingHorizontal: 18, backgroundColor: '#101c17' },
  photoReviewTitle: { color: '#fff', fontSize: 18, lineHeight: 24, fontWeight: '700' },
  photoReviewNote: { color: '#c5dfd0', fontSize: 12, lineHeight: 17, marginTop: 5 },
  photoReviewMedia: { flex: 1, minHeight: 0, marginVertical: 18 },
  photoReviewImage: { width: '100%', height: '100%' },
  photoReviewActions: { flexDirection: 'row', gap: 10 },
  photoReviewButton: { flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  photoCancel: { borderWidth: 1, borderColor: '#b7d3bf' },
  photoSend: { backgroundColor: '#d8eddd' },
  photoCancelText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  photoSendText: { color: forest, fontSize: 14, fontWeight: '800' },
});
