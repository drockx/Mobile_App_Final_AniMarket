import { useState } from 'react';
import { PASSWORD_GUIDANCE } from '../../auth/domain/credential_policy';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { changePassword, useAccount } from '../profile_store';
import { AccountField } from './components/account_field';
import { AccountScreenLayout, accountColors } from './components/account_screen_layout';

export function AccountSecurityScreen({ onBack }: { onBack: () => void }) {
  const account = useAccount();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function update(setter: (value: string) => void, value: string) {
    setter(value);
    setMessage(null);
    setSaved(false);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    const error = await changePassword(current, next, confirmation);
    setBusy(false);
    setSaved(!error);
    setMessage(error ?? 'Password updated. Other sessions have been signed out.');
    if (!error) {
      setCurrent('');
      setNext('');
      setConfirmation('');
    }
  }

  return (
    <AccountScreenLayout title="Account & Security" subtitle="Review your sign-in and update your password." onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sign-in details</Text>
        <Text style={styles.detailLabel}>Email address</Text>
        <Text style={styles.username}>{account.username || 'Not signed in'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Change password</Text>
        <Text style={styles.detailNote}>{PASSWORD_GUIDANCE}</Text>
        <AccountField label="Current Password" required autoComplete="current-password" secureTextEntry value={current} onChangeText={(value) => update(setCurrent, value)} />
        <AccountField label="New Password" required autoComplete="new-password" secureTextEntry value={next} onChangeText={(value) => update(setNext, value)} />
        <AccountField label="Confirm New Password" required autoComplete="new-password" secureTextEntry value={confirmation} onChangeText={(value) => update(setConfirmation, value)} />
        {message && <Text accessibilityRole="alert" style={[styles.message, saved ? styles.success : styles.error]}>{message}</Text>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={save} style={styles.saveButton}><Text style={styles.saveText}>{busy ? 'Updating…' : 'Update Password'}</Text></Pressable>
      </View>
    </AccountScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: { padding: 15, gap: 13, borderWidth: 1, borderColor: accountColors.line, borderRadius: 16, backgroundColor: '#fff' },
  cardTitle: { color: accountColors.forest, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  detailLabel: { color: accountColors.muted, fontSize: 13, lineHeight: 18, fontWeight: '700', marginBottom: -9 },
  username: { color: accountColors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  detailNote: { color: accountColors.muted, fontSize: 13, lineHeight: 18 },
  message: { padding: 11, borderRadius: 10, fontSize: 13, lineHeight: 18 },
  success: { color: '#166534', backgroundColor: '#e8f5eb' },
  error: { color: accountColors.red, backgroundColor: '#fff1ef' },
  saveButton: { minHeight: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: accountColors.forest },
  saveText: { color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '800' },
});
