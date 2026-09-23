import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { validateRegistration, type RegistrationValues } from '../domain/validation';
import { AuthButton } from './components/AuthButton';
import { AuthCheckbox } from './components/AuthCheckbox';
import { AuthField } from './components/AuthField';
import { AuthScreenLayout } from './components/AuthScreenLayout';

type RegisterScreenProps = {
  onBackToLogin: () => void;
};

const initialValues: RegistrationValues = {
  firstName: '', middleName: '', lastName: '', phone: '', email: '',
  purok: '', barangay: '', municipalityCity: '', province: '', postalCode: '',
  password: '', confirmPassword: '',
};

export function RegisterScreen({ onBackToLogin }: RegisterScreenProps) {
  const [values, setValues] = useState<RegistrationValues>(initialValues);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  function updateField(field: keyof RegistrationValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function submit() {
    setMessage(validateRegistration(values, acceptedTerms) ?? 'Registration is ready for an account service to be connected.');
  }

  return (
    <AuthScreenLayout compact>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to login" onPress={onBackToLogin} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>Create Account</Text>
      </View>
      <Text style={styles.subtitle}>Join AniMarket to buy, sell, and connect across the livestock community.</Text>

      <Text style={styles.sectionLabel}>Personal information</Text>
      <View style={styles.fieldGroup}>
        <AuthField compact label="First Name" autoComplete="given-name" value={values.firstName} onChangeText={(value) => updateField('firstName', value)} />
        <AuthField compact label="Middle Name (Optional)" autoComplete="additional-name" value={values.middleName} onChangeText={(value) => updateField('middleName', value)} />
        <AuthField compact label="Last Name" autoComplete="family-name" value={values.lastName} onChangeText={(value) => updateField('lastName', value)} />
      </View>

      <Text style={styles.sectionLabel}>Contact</Text>
      <View style={styles.fieldGroup}>
        <AuthField compact label="Phone Number" autoComplete="tel" keyboardType="phone-pad" value={values.phone} onChangeText={(value) => updateField('phone', value)} />
        <AuthField compact label="Email Address" autoComplete="email" keyboardType="email-address" autoCapitalize="none" value={values.email} onChangeText={(value) => updateField('email', value)} />
      </View>

      <Text style={styles.sectionLabel}>Address</Text>
      <View style={styles.fieldGroup}>
        <AuthField compact label="Purok / Street" autoComplete="address-line1" value={values.purok} onChangeText={(value) => updateField('purok', value)} />
        <AuthField compact label="Barangay" value={values.barangay} onChangeText={(value) => updateField('barangay', value)} />
        <AuthField compact label="Municipality / City" value={values.municipalityCity} onChangeText={(value) => updateField('municipalityCity', value)} />
        <AuthField compact label="Province" value={values.province} onChangeText={(value) => updateField('province', value)} />
        <AuthField compact label="Postal Code" autoComplete="postal-code" keyboardType="number-pad" maxLength={4} value={values.postalCode} onChangeText={(value) => updateField('postalCode', value)} />
      </View>

      <Text style={styles.sectionLabel}>Security</Text>
      <View style={styles.fieldGroup}>
        <AuthField compact label="Password" autoComplete="new-password" secure value={values.password} onChangeText={(value) => updateField('password', value)} />
        <AuthField compact label="Confirm Password" autoComplete="new-password" secure value={values.confirmPassword} onChangeText={(value) => updateField('confirmPassword', value)} />
      </View>

      <View style={styles.terms}>
        <AuthCheckbox
          checked={acceptedTerms}
          onChange={setAcceptedTerms}
          label="I agree to the Terms and Conditions and Privacy Policy."
        />
      </View>
      {message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
      <AuthButton label="Register" onPress={submit} compact />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account? </Text>
        <Pressable accessibilityRole="link" onPress={onBackToLogin}>
          <Text style={styles.switchLink}>Login</Text>
        </Pressable>
      </View>
      <Text style={styles.credit}>AniMarket</Text>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 13 },
  backButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: '#fff', fontSize: 27, lineHeight: 32 },
  title: { flexShrink: 1, color: '#fff', fontSize: 32, lineHeight: 38, letterSpacing: -1, fontWeight: '700' },
  subtitle: { color: '#fff', fontSize: 15, lineHeight: 23, marginBottom: 16 },
  sectionLabel: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 16, marginBottom: 11 },
  fieldGroup: { gap: 13 },
  terms: { marginTop: 20, marginBottom: 17 },
  message: { color: '#fff', backgroundColor: 'rgba(20,31,24,0.5)', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 },
  switchText: { color: '#fff', fontSize: 15 },
  switchLink: { color: '#fff', fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  credit: { color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: '700', marginTop: 28 },
});
