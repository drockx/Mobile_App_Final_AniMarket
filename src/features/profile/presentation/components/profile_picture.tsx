import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavigationIcon } from '@/components/navigation_icon';
import { apiRequest } from '@/services/api';
import { getAccountSnapshot, refreshAccount, removeProfilePhoto, saveProfilePhoto, useAccount } from '../../profile_store';
import { accountColors as c } from './account_screen_layout';
import { verificationStyles as s } from './verification_styles';

type SavedPhoto = { userId: string; version: string; uri: string };
type PhotoDraft = { base64: string; uri: string };

export function ProfilePicture({ initials, compact = false, editable = false }: { initials: string; compact?: boolean; editable?: boolean }) {
  const account = useAccount();
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState<SavedPhoto | null>(null);
  const [draft, setDraft] = useState<PhotoDraft | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const source = saved?.userId === account.userId && saved.version === account.avatarVersion ? saved.uri : null;

  useEffect(() => {
    if (!account.avatarVersion) return;
    let active = true; const controller = new AbortController();
    void apiRequest<{ version: string; photo: string }>('/auth/photo', { signal: controller.signal }).then((result) => {
      if (!active || getAccountSnapshot().userId !== account.userId) return;
      setSaved({ userId: account.userId, version: result.version, uri: result.photo });
      if (result.version !== account.avatarVersion) void refreshAccount().catch(() => {});
    }).catch((issue) => { if (active) setError(issue instanceof Error ? issue.message : 'Unable to load your profile photo.'); });
    return () => { active = false; controller.abort(); };
  }, [account.userId, account.avatarVersion, reload]);

  function showEditor() {
    setDraft(null); setError(''); setOpen(true); setReload((value) => value + 1);
  }
  function close() { if (!working.current) { setOpen(false); setDraft(null); setError(''); } }
  async function choose(camera: boolean) {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      if (camera && Platform.OS !== 'web' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera access or choose a photo from your gallery.');
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1, cameraType: ImagePicker.CameraType.front };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const original = await ImageManipulator.manipulate(result.assets[0].uri).renderAsync();
      const side = Math.min(original.width, original.height);
      if (side <= 0) throw new Error('Unable to read this photo. Please choose another image.');
      const context = ImageManipulator.manipulate(original).crop({ originX: Math.floor((original.width - side) / 2), originY: Math.floor((original.height - side) / 2), width: side, height: side });
      const image = await context.resize({ width: Math.min(side, 512), height: Math.min(side, 512) }).renderAsync();
      const photo = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
      if (!photo.base64 || photo.base64.length * 3 / 4 > 1024 * 1024) throw new Error('Choose a smaller photo and try again.');
      if (getAccountSnapshot().userId === account.userId) setDraft({ uri: photo.uri, base64: photo.base64 });
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'Unable to choose your profile photo.'); }
    finally { working.current = false; setBusy(false); }
  }
  async function save() {
    if (working.current || !draft) return;
    working.current = true; setBusy(true); setError('');
    try {
      const next = await saveProfilePhoto(draft.base64);
      if (next.avatarVersion) setSaved({ userId: next.userId, version: next.avatarVersion, uri: `data:image/jpeg;base64,${draft.base64}` });
      setDraft(null); setOpen(false);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to save your profile photo.');
      void refreshAccount().catch(() => {});
    } finally { working.current = false; setBusy(false); }
  }
  async function remove() {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try { await removeProfilePhoto(); setSaved(null); setDraft(null); setOpen(false); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Unable to remove your profile photo.'); }
    finally { working.current = false; setBusy(false); }
  }

  return <>
    <View style={[styles.avatar, compact && styles.compact]}>
      {source ? <Image source={source} cachePolicy="none" contentFit="cover" accessibilityLabel="Your profile photo" style={styles.image} /> : <Text style={styles.initials}>{initials}</Text>}
    </View>
    {editable && <Pressable accessibilityRole="button" onPress={showEditor} style={styles.editButton}>
      <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} size={18} tintColor={c.forest} />
      <Text style={styles.editText}>{account.avatarVersion ? 'Change Photo' : 'Add Photo'}</Text>
    </Pressable>}
    {editable && <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close profile photo editor" disabled={busy} onPress={close} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16), marginTop: insets.top + 12 }]}>
          <View style={styles.header}>
            <Text style={[s.title, styles.heading]}>Profile Photo</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close profile photo editor" disabled={busy} onPress={close} style={styles.close}><NavigationIcon name="close" /></Pressable>
          </View>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.preview}>
              {draft?.uri || source ? <Image source={draft?.uri ?? source} cachePolicy="none" contentFit="cover" accessibilityLabel="Profile photo preview" style={styles.previewImage} /> : <Text style={styles.previewInitials}>{initials}</Text>}
            </View>
            <Text style={[s.note, styles.center]}>Choose a photo of yourself. Check the square preview before saving.</Text>
            {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
            <View style={s.row}>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void choose(false); }} style={[s.secondary, s.flexButton, busy && s.disabled]}><Text style={s.secondaryText}>Choose Photo</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void choose(true); }} style={[s.secondary, s.flexButton, busy && s.disabled]}><Text style={s.secondaryText}>Take Photo</Text></Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !draft }} disabled={busy || !draft} onPress={() => { void save(); }} style={[s.button, (busy || !draft) && s.disabled]}>
              {busy ? <ActivityIndicator color="#fff" accessibilityLabel="Updating profile photo" /> : <Text style={s.buttonText}>Save Photo</Text>}
            </Pressable>
            {!!account.avatarVersion && <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void remove(); }} style={s.secondary}><Text style={[s.secondaryText, styles.remove]}>Remove Photo</Text></Pressable>}
          </ScrollView>
        </View>
      </View>
    </Modal>}
  </>;
}

const styles = StyleSheet.create({
  avatar: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf5ed' },
  compact: { width: 55, height: 55 },
  image: { width: '100%', height: '100%', borderRadius: 18 },
  initials: { color: c.forest, fontSize: 20, fontWeight: '800' },
  editButton: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 11, borderWidth: 1, borderColor: c.forest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch' },
  editText: { color: c.forest, fontSize: 14, lineHeight: 20, fontWeight: '700', flexShrink: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,28,20,0.5)' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '90%', alignSelf: 'center', borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: c.line },
  heading: { flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 13 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  preview: { width: 120, height: 120, borderRadius: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: '#eaf5ed' },
  previewImage: { width: '100%', height: '100%', borderRadius: 22 },
  previewInitials: { color: c.forest, fontSize: 32, fontWeight: '800' },
  center: { textAlign: 'center' },
  remove: { color: c.red },
});
