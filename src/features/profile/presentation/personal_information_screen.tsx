import { NavigationIcon } from '@/components/navigation_icon';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DAVAO_DEL_NORTE, DAVAO_DEL_NORTE_LOCALITIES, davaoDelNorteLocalityLabel } from '@/constants/davao_del_norte';

import { savePersonalInformation, useAccount } from '../profile_store';
import { AccountField } from './components/account_field';
import { AccountScreenLayout, accountColors } from './components/account_screen_layout';
import { ProfilePicture } from './components/profile_picture';

export function PersonalInformationScreen({ onBack }: { onBack: () => void }) {
  const account = useAccount();
  const [values, setValues] = useState(account.personal);
  const [cityOpen, setCityOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const emailChanged = values.email.trim().toLowerCase() !== account.personal.email.toLowerCase();

  function update<K extends keyof typeof values>(key: K, value: typeof values[K]) {
    if (key === 'email') { setCurrentPassword(''); }
    setValues((current) => ({ ...current, [key]: value }));
    setMessage(null);
    setSaved(false);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    const error = await savePersonalInformation(values, emailChanged ? { currentPassword } : undefined);
    setBusy(false);
    setSaved(!error);
    setMessage(error ?? 'Personal information saved.');
    if (!error) { setCurrentPassword(''); }
  }

  return (
    <AccountScreenLayout title="Edit Profile" subtitle="Update your profile photo, contact information and livestock location." onBack={onBack}>
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
        <View style={styles.field}>
          <Text style={styles.label}>Municipality / City <Text style={styles.required}>*</Text></Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Municipality or City, ${values.city}`} onPress={() => setCityOpen(true)} style={styles.select}>
            <Text style={styles.selectText}>{davaoDelNorteLocalityLabel(values.city)}</Text>
            <NavigationIcon name={cityOpen ? 'up' : 'down'} />
          </Pressable>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Province</Text>
          <View style={styles.readonlyField}><Text style={styles.readonlyText}>{DAVAO_DEL_NORTE}</Text></View>
        </View>
      </View>

      {message && <Text accessibilityRole="alert" style={[styles.message, saved ? styles.success : styles.error]}>{message}</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={save} style={styles.saveButton}><Text style={styles.saveText}>{busy ? 'Saving…' : 'Save Changes'}</Text></Pressable>

      <Modal visible={cityOpen} transparent animationType="fade" onRequestClose={() => setCityOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close city list" onPress={() => setCityOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Municipality / City</Text>
            <ScrollView style={styles.cityList} keyboardShouldPersistTaps="handled">
              {DAVAO_DEL_NORTE_LOCALITIES.map((city) => (
                <Pressable key={city} accessibilityRole="button" accessibilityState={{ selected: values.city === city }} onPress={() => { update('city', city); setCityOpen(false); }} style={styles.cityOption}>
                  <Text style={[styles.cityText, values.city === city && styles.citySelected]}>{davaoDelNorteLocalityLabel(city)}</Text>
                  {values.city === city && <Text style={styles.citySelected}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AccountScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: { padding: 15, gap: 16, borderWidth: 1, borderColor: accountColors.line, borderRadius: 16, backgroundColor: '#fff' },
  photoCard: { alignItems: 'center' },
  field: { gap: 7 },
  label: { color: accountColors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  required: { color: accountColors.red },
  select: { minHeight: 48, gap: 8, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1, borderColor: accountColors.line, borderRadius: 11, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  selectText: { flex: 1, minWidth: 0, color: accountColors.text, fontSize: 16, lineHeight: 22 },
  readonlyField: { minHeight: 48, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1, borderColor: accountColors.line, borderRadius: 11, justifyContent: 'center', backgroundColor: accountColors.surface },
  readonlyText: { color: accountColors.muted, fontSize: 14, lineHeight: 20 },
  message: { padding: 11, borderRadius: 10, fontSize: 13, lineHeight: 18 },
  success: { color: '#166534', backgroundColor: '#e8f5eb' },
  error: { color: accountColors.red, backgroundColor: '#fff1ef' },
  saveButton: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: accountColors.forest },
  saveText: { color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  note: { color: accountColors.muted, fontSize: 13, lineHeight: 18 },
  modalBackdrop: { flex: 1, padding: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,28,20,0.5)' },
  modalCard: { width: '100%', maxWidth: 380, maxHeight: '85%', padding: 14, borderRadius: 16, backgroundColor: '#fff' },
  modalTitle: { color: accountColors.forest, fontSize: 16, lineHeight: 22, fontWeight: '800', marginBottom: 8 },
  cityList: { maxHeight: 420, flexShrink: 1 },
  cityOption: { minHeight: 48, paddingHorizontal: 8, paddingVertical: 10, gap: 8, borderTopWidth: 1, borderTopColor: '#edf2ee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cityText: { flex: 1, minWidth: 0, color: accountColors.text, fontSize: 14, lineHeight: 20 },
  citySelected: { color: accountColors.forest, fontWeight: '800' },
});
