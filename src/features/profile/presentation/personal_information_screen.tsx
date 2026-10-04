import { AddressSelect } from '@/components/address_select';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appFormStyles } from '@/constants/app_theme';

import { DAVAO_DEL_NORTE, DAVAO_DEL_NORTE_LOCALITIES, davaoDelNorteLocalityLabel, isDavaoDelNorteLocality } from '@/constants/davao_del_norte';
import { barangaysForLocality } from '@/constants/davao_del_norte_barangays';
import { updatePersonalInformation, validatePersonalAddress, type AddressErrors } from '../domain/personal_information';

import { savePersonalInformation, useAccount } from '../profile_store';
import { AccountField } from './components/account_field';
import { AccountScreenLayout, accountColors } from './components/account_screen_layout';
import { ProfilePicture } from './components/profile_picture';

export function PersonalInformationScreen({ onBack }: { onBack: () => void }) {
  const account = useAccount();
  const [values, setValues] = useState(account.personal);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const emailChanged = values.email.trim().toLowerCase() !== account.personal.email.toLowerCase();

  function update<K extends keyof typeof values>(key: K, value: typeof values[K]) {
    if (key === 'email') { setCurrentPassword(''); }
    setValues((current) => updatePersonalInformation(current, key, value));
    setErrors((current) => ({ ...current, [key]: undefined, ...(key === 'city' ? { barangay: undefined } : {}) }));
    setMessage(null);
    setSaved(false);
  }

  async function save() {
    if (busy) return;
    const addressErrors = validatePersonalAddress(values);
    setErrors(addressErrors);
    if (Object.keys(addressErrors).length) { setSaved(false); setMessage('Please review the highlighted address fields.'); return; }
    setBusy(true);
    const error = await savePersonalInformation(values, emailChanged ? { currentPassword } : undefined);
    setBusy(false);
    setSaved(!error);
    setMessage(error ?? 'Personal information saved.');
    if (!error) { setCurrentPassword(''); }
  }

  return (
    <AccountScreenLayout title="Personal Information" subtitle="Update your photo, contact information and address." onBack={onBack}>
      <View style={[styles.card, styles.photoCard]}>
        <Text style={styles.label}>Profile Photo</Text>
        <ProfilePicture key={account.userId} initials={account.personal.fullName.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'AM'} editable />
      </View>
      <View style={styles.card}>
        <AccountField label="Full Name" required autoComplete="name" autoCapitalize="words" value={values.fullName} onChangeText={(value) => update('fullName', value)} />
        {['pending', 'verified'].includes(account.verification.status) && <Text style={styles.note}>Changing your full name removes your current ID verification. Use the name on your valid ID.</Text>}
        <AccountField label="Email Address" autoComplete="email" autoCapitalize="none" keyboardType="email-address" value={values.email} onChangeText={(value) => update('email', value)} />
        {emailChanged && <>
          <AccountField label="Current Password to Change Email" autoComplete="current-password" secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} />
        </>}
        <AccountField label="Phone Number" autoComplete="tel" keyboardType="phone-pad" value={values.phone} onChangeText={(value) => update('phone', value)} />
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Address</Text>
        <Text style={styles.note}>Choose your city or municipality first, then your barangay.</Text>
        <AddressSelect label="City / Municipality" value={values.city} options={DAVAO_DEL_NORTE_LOCALITIES.map((city) => ({ label: davaoDelNorteLocalityLabel(city), value: city }))} onSelect={(value) => { if (isDavaoDelNorteLocality(value)) update('city', value); }} placeholder="Choose city or municipality" error={errors.city} />
        <AddressSelect label="Barangay" value={values.barangay ?? ''} options={barangaysForLocality(values.city).map((name) => ({ label: name, value: name }))} onSelect={(value) => update('barangay', value)} disabled={!values.city} placeholder={values.city ? 'Choose barangay' : 'Choose city or municipality first'} dialogTitle={values.city ? `Barangays in ${davaoDelNorteLocalityLabel(values.city)}` : 'Choose barangay'} error={errors.barangay} />
        <AccountField label="Purok" required autoComplete="address-line1" autoCapitalize="words" maxLength={150} returnKeyType="next" value={values.street ?? ''} onChangeText={(value) => update('street', value)} error={errors.street} />
        <View style={styles.field}>
          <Text style={styles.label}>Province</Text>
          <View style={styles.readonlyField}><Text style={styles.readonlyText}>{DAVAO_DEL_NORTE}</Text></View>
        </View>
        <AccountField label="Postal Code" required autoComplete="postal-code" keyboardType="number-pad" maxLength={4} returnKeyType="done" value={values.postalCode ?? ''} onChangeText={(value) => update('postalCode', value)} error={errors.postalCode} />
      </View>

      {message && <Text accessibilityRole="alert" style={[styles.message, saved ? styles.success : styles.error]}>{message}</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={save} style={styles.saveButton}><Text style={styles.saveText}>{busy ? 'Saving…' : 'Save Changes'}</Text></Pressable>

    </AccountScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: { padding: 15, gap: 16, borderWidth: 1, borderColor: accountColors.line, borderRadius: 16, backgroundColor: '#fff' },
  photoCard: { alignItems: 'center' },
  field: { ...appFormStyles.field },
  label: { ...appFormStyles.label, color: accountColors.text },
  sectionTitle: { color: accountColors.forest, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  readonlyField: { ...appFormStyles.control, borderColor: accountColors.line, justifyContent: 'center', backgroundColor: accountColors.surface },
  readonlyText: { ...appFormStyles.value, color: accountColors.muted },
  message: { padding: 11, borderRadius: 10, fontSize: 13, lineHeight: 18 },
  success: { color: '#166534', backgroundColor: '#e8f5eb' },
  error: { color: accountColors.red, backgroundColor: '#fff1ef' },
  saveButton: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: accountColors.forest },
  saveText: { color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  note: { color: accountColors.muted, fontSize: 13, lineHeight: 18 },
});
