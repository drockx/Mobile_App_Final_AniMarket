import { useState } from 'react';
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

  function update(setter: (value: string) => void, value: string) {
    setter(value);
    setMessage(null);
    setSaved(false);
  }

  function save() {
    const error = changePassword(current, next, confirmation);
    setSaved(!error);
    setMessage(error ?? 'Demo password changed for this app session.');
    if (!error) {
      setCurrent('');
      setNext('');
      setConfirmation('');
    }
  }

  return (
    <AccountScreenLayout title="Account & Security" subtitle="Review your sign-in and update your demo password." onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sign-in details</Text>
        <Text style={styles.detailLabel}>Username</Text>
        <Text style={styles.username}>{account.username || 'Not signed in'}</Text>
        <Text style={styles.detailNote}>This app currently uses a local demo account. It is not connected to an authentication service.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Change demo password</Text>
        <Text style={styles.detailNote}>Your new password works for this account until the app closes.</Text>
        <AccountField label="Current Password" required autoComplete="current-password" secureTextEntry value={current} onChangeText={(value) => update(setCurrent, value)} />
        <AccountField label="New Password" required autoComplete="new-password" secureTextEntry value={next} onChangeText={(value) => update(setNext, value)} />
        <AccountField label="Confirm New Password" required autoComplete="new-password" secureTextEntry value={confirmation} onChangeText={(value) => update(setConfirmation, value)} />
        {message && <Text accessibilityRole="alert" style={[styles.message, saved ? styles.success : styles.error]}>{message}</Text>}
        <Pressable accessibilityRole="button" onPress={save} style={styles.saveButton}><Text style={styles.saveText}>Update Password</Text></Pressable>
      </View>
    </AccountScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: { padding: 15, gap: 13, borderWidth: 1, borderColor: accountColors.line, borderRadius: 16, backgroundColor: '#fff' },
  cardTitle: { color: accountColors.forest, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  detailLabel: { color: accountColors.muted, fontSize: 12, lineHeight: 16, fontWeight: '700', marginBottom: -9 },
  username: { color: accountColors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  detailNote: { color: accountColors.muted, fontSize: 12, lineHeight: 18 },
  message: { padding: 11, borderRadius: 10, fontSize: 12, lineHeight: 17 },
  success: { color: '#166534', backgroundColor: '#e8f5eb' },
  error: { color: accountColors.red, backgroundColor: '#fff1ef' },
  saveButton: { minHeight: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: accountColors.forest },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
