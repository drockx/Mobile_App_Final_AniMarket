import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, Pressable, Text, View } from 'react-native';

import { NavigationIcon } from '@/components/navigation_icon';
import { apiRequest } from '@/services/api';
import { validIdTypes, verificationLabels, type IdReview, type ValidIdType } from '../domain/identity_verification';
import { profileAddress, validatePersonalAddress } from '../domain/personal_information';
import { getAccountSnapshot, refreshAccount, submitIdentity, useAccount, withdrawIdentity } from '../profile_store';
import { AccountScreenLayout } from './components/account_screen_layout';
import { verificationStyles as s } from './components/verification_styles';
import { PrivateIdPreview } from './components/private_id_preview';

const messages = {
  unverified: 'Submit a clear photo of your valid ID to verify your identity before buying or selling.',
  pending: 'Your ID has been submitted. An authorized reviewer will check it before your account is verified.',
  verified: 'Your valid ID was reviewed and approved. You can place orders and publish livestock listings.',
  rejected: 'Follow the reviewer’s feedback and submit a clearer or corrected ID photo.',
  expired: 'Your pending ID photo was removed after 30 days. Submit a new photo to continue.',
};

export function AccountVerificationScreen({ onBack, onPersonalInformation }: { onBack: () => void; onPersonalInformation: () => void }) {
  const account = useAccount();
  const status = account.verification.status;
  const [idType, setIdType] = useState<ValidIdType>('National ID');
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const maySubmit = !['pending', 'verified'].includes(status);
  const addressComplete = Object.keys(validatePersonalAddress(account.personal)).length === 0;

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') void refreshAccount().then((next) => {
        if (active && next.verification.status !== 'pending') setPendingPhoto(null);
      }).catch((issue) => { if (active) setError(issue.message); });
    };
    refresh();
    const timer = status === 'pending' ? setInterval(refresh, 10000) : undefined;
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [status]);

  async function choosePhoto(camera: boolean) {
    if (busyRef.current) return;
    if (Object.keys(validatePersonalAddress(getAccountSnapshot().personal)).length) {
      setError('Complete your address in Personal Information before selecting your ID photo.'); return;
    }
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (camera && Platform.OS !== 'web' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera access or choose an ID photo from your gallery.');
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.85, allowsEditing: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) {
        const asset = result.assets[0];
        if (!asset.base64) throw new Error('Unable to read the photo. Please choose another JPEG or PNG image.');
        if (asset.base64.length * 3 / 4 > 5 * 1024 * 1024) throw new Error('Choose an ID photo smaller than 5 MB.');
        setPhoto({ uri: asset.uri, base64: asset.base64 }); setConsent(false);
      }
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'Unable to select your ID photo.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function submit() {
    if (busyRef.current || !photo || !consent) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await submitIdentity(idType, photo.base64); setPhoto(null); setConsent(false); }
    catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to submit your ID.');
      // A lost upload response can still mean the server accepted the ID.
      void refreshAccount().catch(() => {});
    }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function withdraw() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await withdrawIdentity(); setPendingPhoto(null); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Unable to withdraw your ID.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function confirmWithdraw() {
    const message = 'Remove your submitted ID and verification status? You can submit a new photo later.';
    if (Platform.OS === 'web') { if (window.confirm(message)) void withdraw(); }
    else Alert.alert('Withdraw verification?', message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Withdraw', style: 'destructive', onPress: () => { void withdraw(); } }]);
  }
  async function viewPhoto() {
    if (viewing || busyRef.current) return;
    if (pendingPhoto) { setPendingPhoto(null); return; }
    busyRef.current = true; setBusy(true); setViewing(true); setError('');
    try {
      const result = await apiRequest<IdReview>('/verification/id');
      if (getAccountSnapshot().userId === account.userId && getAccountSnapshot().verification.status === 'pending') setPendingPhoto(result.photo ?? null);
    }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Unable to view your ID.'); }
    finally { busyRef.current = false; setBusy(false); setViewing(false); }
  }

  return (
    <AccountScreenLayout title="Account Verification" subtitle="Verify your identity using a valid photo ID." onBack={onBack}>
      <View style={s.status}>
        <Text style={s.title}>{verificationLabels[status]}</Text>
        <Text style={s.body}>{messages[status]}</Text>
        {!!account.verification.reason && <Text style={s.body}>{account.verification.reason}</Text>}
        {!!account.verification.idType && <Text style={s.note}>ID type: {account.verification.idType}</Text>}
      </View>
      <View style={s.card}>
        <Text style={s.title}>Account details</Text>
        <Text style={s.label}>Full name on your ID</Text>
        <Text style={s.body}>{account.personal.fullName}</Text>
        <Text style={s.note}>{account.personal.phone}{'\n'}{profileAddress(account.personal) || 'Address not provided'}</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onPersonalInformation} style={s.secondary}><Text style={s.secondaryText}>Edit Personal Information</Text></Pressable>
        <Text style={s.note}>Your account name must match your ID. Changing it requires a new ID review.</Text>
      </View>
      {!addressComplete && <View style={s.status}>
        <Text style={s.title}>Address required</Text>
        <Text style={s.body}>Complete your Purok, Barangay, City/Municipality and postal code in Personal Information before submitting your ID for verification.</Text>
        <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={onPersonalInformation} style={[s.button, busy && s.disabled]}><Text style={s.buttonText}>Complete Address</Text></Pressable>
      </View>}
      {maySubmit && addressComplete && <View style={s.card}>
        <Text style={s.title}>Valid ID photo</Text>
        <Text style={s.note}>Use your National ID or another valid photo ID. Include the whole ID with your name and photo clearly readable.</Text>
        <Text style={s.label}>ID type</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`ID type, ${idType}`} accessibilityState={{ expanded: open, disabled: busy }} disabled={busy} onPress={() => setOpen(!open)} style={s.select}>
          <Text style={s.selectText}>{idType}</Text><NavigationIcon name={open ? 'up' : 'down'} />
        </Pressable>
        {open && <View style={s.options}>{validIdTypes.map((type) => <Pressable key={type} accessibilityRole="button" accessibilityState={{ selected: type === idType }} onPress={() => { setIdType(type); setOpen(false); }} style={[s.option, type === idType && s.selectedOption]}><Text style={s.body}>{type}</Text></Pressable>)}</View>}
        {photo && <PrivateIdPreview source={photo.uri} label="Selected valid ID photo" />}
        <View style={s.row}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void choosePhoto(false); }} style={[s.secondary, s.flexButton, busy && s.disabled]}><Text style={s.secondaryText}>{photo ? 'Replace Photo' : 'Choose Photo'}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void choosePhoto(true); }} style={[s.secondary, s.flexButton, busy && s.disabled]}><Text style={s.secondaryText}>Take Photo</Text></Pressable>
        </View>
        <Text style={s.note}>JPEG or PNG, up to 5 MB. One clear ID photo is enough.</Text>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent, disabled: busy }} disabled={busy} onPress={() => setConsent(!consent)} style={s.consent}>
          <View style={[s.checkbox, consent && s.checked]}>{consent && <Text style={s.checkmark}>✓</Text>}</View>
          <Text style={s.consentText}>I confirm this is my valid ID and agree to its use for identity verification.</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !photo || !consent }} disabled={busy || !photo || !consent} onPress={() => { void submit(); }} style={[s.button, (busy || !photo || !consent) && s.disabled]}><Text style={s.buttonText}>{busy ? 'Please wait…' : 'Submit ID for Review'}</Text></Pressable>
      </View>}
      {status === 'pending' && <View style={s.card}>
        {pendingPhoto && <PrivateIdPreview source={pendingPhoto} label="Your submitted ID photo" />}
        <Pressable accessibilityRole="button" disabled={viewing || busy} onPress={() => { void viewPhoto(); }} style={s.secondary}><Text style={s.secondaryText}>{viewing ? 'Loading…' : pendingPhoto ? 'Hide Submitted Photo' : 'View Submitted Photo'}</Text></Pressable>
      </View>}
      <View style={s.card}>
        <Text style={s.title}>Your ID stays private</Text>
        <Text style={s.note}>Only you and authorized reviewers can view the submitted photo. It is encrypted in storage and removed after review, or after 30 days if still pending.</Text>
        {['pending', 'verified'].includes(status) && <Pressable accessibilityRole="button" disabled={busy} onPress={confirmWithdraw} style={s.secondary}><Text style={s.secondaryText}>Withdraw Verification</Text></Pressable>}
      </View>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    </AccountScreenLayout>
  );
}
