import { NavigationIcon } from '@/components/navigation_icon';
import { AddressSelect } from '@/components/address_select';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DAVAO_DEL_NORTE, DAVAO_DEL_NORTE_LOCALITIES, davaoDelNorteLocalityLabel } from '@/constants/davao_del_norte';
import { barangaysForLocality } from '@/constants/davao_del_norte_barangays';

import {
  validateRegistrationFields,
  type RegistrationFieldErrors,
  type RegistrationValues,
} from '../domain/validation';
import { AuthButton } from './components/auth_button';
import { AuthCheckbox } from './components/auth_checkbox';
import { AuthField } from './components/auth_field';
import { AuthScreenLayout } from './components/auth_screen_layout';
import { passwordRequirements } from '../domain/credential_policy';

type RegisterScreenProps = {
  onBackToLogin: () => void;
  onRegister: (values: RegistrationValues) => Promise<string | null>;
};

const initialValues: RegistrationValues = {
  firstName: '', middleName: '', lastName: '', phone: '', email: '',
  purok: '', barangay: '', municipalityCity: '', province: DAVAO_DEL_NORTE, postalCode: '',
  password: '', confirmPassword: '',
};

export function RegisterScreen({ onBackToLogin, onRegister }: RegisterScreenProps) {
  const [values, setValues] = useState<RegistrationValues>(initialValues);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  function updateField(field: keyof RegistrationValues, value: string) {
    setValues((current) => ({ ...current, [field]: value, ...(field === 'municipalityCity' && value !== current.municipalityCity ? { barangay: '' } : {}) }));
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
    setMessage(null);
  }

  async function submit() {
    if (submitting.current) return;
    const nextErrors = validateRegistrationFields(values, acceptedTerms);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setMessage('Please review the highlighted fields.');
      return;
    }

    submitting.current = true; setBusy(true);
    try { setMessage(await onRegister(values)); }
    catch { setMessage('Unable to create your account. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  return (
    <AuthScreenLayout compact>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to login"
          hitSlop={8}
          onPress={onBackToLogin}
          style={styles.backButton}
        >
          <NavigationIcon name="back" color="#fff" />
        </Pressable>
        <Text style={styles.title}>Create Account</Text>
      </View>
      <Text style={styles.subtitle}>Join AniMarket to buy, sell, and connect across Davao del Norte.</Text>

      <Text style={styles.sectionLabel}>Personal information</Text>
      <View style={styles.fieldGroup}>
        <AuthField compact label="First Name" autoComplete="given-name" returnKeyType="next" error={errors.firstName} value={values.firstName} onChangeText={(value) => updateField('firstName', value)} />
        <AuthField compact label="Middle Name (Optional)" autoComplete="additional-name" returnKeyType="next" value={values.middleName} onChangeText={(value) => updateField('middleName', value)} />
        <AuthField compact label="Last Name" autoComplete="family-name" returnKeyType="next" error={errors.lastName} value={values.lastName} onChangeText={(value) => updateField('lastName', value)} />
      </View>

      <Text style={styles.sectionLabel}>Contact</Text>
      <View style={styles.fieldGroup}>
        <AuthField compact label="Phone Number" autoComplete="tel" keyboardType="phone-pad" returnKeyType="next" error={errors.phone} value={values.phone} onChangeText={(value) => updateField('phone', value)} />
        <AuthField compact label="Email Address" autoComplete="email" keyboardType="email-address" autoCapitalize="none" returnKeyType="next" error={errors.email} value={values.email} onChangeText={(value) => updateField('email', value)} />
      </View>

      <Text style={styles.sectionLabel}>Address</Text>
      <View style={styles.fieldGroup}>
        <AddressSelect dark required={false} label="Municipality / City" value={values.municipalityCity} options={DAVAO_DEL_NORTE_LOCALITIES.map((city) => ({ label: davaoDelNorteLocalityLabel(city), value: city }))} onSelect={(value) => updateField('municipalityCity', value)} placeholder="Choose city or municipality" error={errors.municipalityCity} />
        <AddressSelect dark required={false} label="Barangay" value={values.barangay} options={barangaysForLocality(values.municipalityCity).map((name) => ({ label: name, value: name }))} onSelect={(value) => updateField('barangay', value)} disabled={!values.municipalityCity} placeholder={values.municipalityCity ? 'Choose barangay' : 'Choose city or municipality first'} dialogTitle={`Barangays in ${values.municipalityCity}`} error={errors.barangay} />
        <AuthField compact label="Purok / Street" autoComplete="address-line1" returnKeyType="next" error={errors.purok} value={values.purok} onChangeText={(value) => updateField('purok', value)} />
        <View>
          <Text style={styles.addressLabel}>Province</Text>
          <View style={styles.addressSelect}><Text style={styles.addressValue}>{DAVAO_DEL_NORTE}</Text></View>
        </View>
        <AuthField compact label="Postal Code" autoComplete="postal-code" keyboardType="number-pad" maxLength={4} returnKeyType="next" error={errors.postalCode} value={values.postalCode} onChangeText={(value) => updateField('postalCode', value)} />
      </View>

      <Text style={styles.sectionLabel}>Security</Text>
      <View style={styles.fieldGroup}>
        <AuthField compact label="Password" autoComplete="new-password" secure returnKeyType="next" error={errors.password} value={values.password} onChangeText={(value) => updateField('password', value)} />
        <View style={styles.passwordRules}>
          <Text style={styles.rulesTitle}>Password requirements</Text>
          {passwordRequirements(values.password).map((rule) => <Text key={rule.label} accessibilityLabel={`${rule.met ? 'Met' : 'Required'}: ${rule.label}`} style={styles.ruleText}>{rule.met ? '✓' : '○'}  {rule.label}</Text>)}
        </View>
        <AuthField compact label="Confirm Password" autoComplete="new-password" secure returnKeyType="done" error={errors.confirmPassword} value={values.confirmPassword} onChangeText={(value) => updateField('confirmPassword', value)} />
      </View>

      <View style={styles.terms}>
        <AuthCheckbox
          checked={acceptedTerms}
          onChange={(checked) => {
            setAcceptedTerms(checked);
            if (checked && errors.terms) {
              setErrors((current) => ({ ...current, terms: undefined }));
            }
            setMessage(null);
          }}
          label="I agree to the Terms and Conditions and Privacy Policy."
        />
        {errors.terms ? <Text accessibilityRole="alert" style={styles.termsError}>{errors.terms}</Text> : null}
      </View>

      {message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
      <AuthButton label={busy ? 'Creating account…' : 'Register'} onPress={submit} compact disabled={busy} />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account?</Text>
        <Pressable accessibilityRole="link" disabled={busy} onPress={onBackToLogin} style={styles.switchButton}>
          <Text style={styles.switchLink}>Log in</Text>
        </Pressable>
      </View>
      <Text style={styles.credit}>AniMarket</Text>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  backButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  title: { flexShrink: 1, color: '#fff', fontSize: 27, lineHeight: 34, letterSpacing: -0.6, fontWeight: '700' },
  subtitle: { color: '#fff', fontSize: 14, lineHeight: 21, marginBottom: 10 },
  sectionLabel: { color: '#fff', fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.45, textTransform: 'uppercase', marginTop: 13, marginBottom: 8 },
  fieldGroup: { gap: 10 },
  passwordRules: { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 12, padding: 12, gap: 4 },
  rulesTitle: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '700', marginBottom: 2 },
  ruleText: { color: '#fff', fontSize: 14, lineHeight: 21, flexShrink: 1 },
  addressLabel: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '700', includeFontPadding: false, marginBottom: 8 },
  addressSelect: { minHeight: 52, borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.78)', backgroundColor: 'rgba(0,0,0,0.24)', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  addressValue: { flex: 1, minWidth: 0, color: '#fff', fontSize: 16, lineHeight: 22, includeFontPadding: false },
  terms: { marginTop: 16, marginBottom: 14 },
  termsError: { color: '#ffd2ca', fontSize: 14, lineHeight: 20, marginTop: 4, marginLeft: 38 },
  message: { color: '#fff', backgroundColor: 'rgba(20,31,24,0.5)', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 4, marginTop: 14 },
  switchText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  switchLink: { color: '#fff', fontSize: 15, lineHeight: 22, fontWeight: '700', textDecorationLine: 'underline' },
  switchButton: { minHeight: 44, justifyContent: 'center' },
  credit: { color: '#fff', textAlign: 'center', fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 24 },
});
