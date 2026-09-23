import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { validateLogin, type LoginValues } from '../domain/validation';
import { AuthButton } from './components/AuthButton';
import { AuthCheckbox } from './components/AuthCheckbox';
import { AuthField } from './components/AuthField';
import { AuthScreenLayout } from './components/AuthScreenLayout';

type LoginScreenProps = {
  onSignup: () => void;
};

export function LoginScreen({ onSignup }: LoginScreenProps) {
  const [values, setValues] = useState<LoginValues>({ username: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    setMessage(validateLogin(values) ?? 'Login is ready for an authentication service to be connected.');
  }

  return (
    <AuthScreenLayout>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.subtitle}>Welcome back please login to your account</Text>

      <View style={styles.fields}>
        <AuthField
          label="User Name"
          autoComplete="username"
          autoCapitalize="none"
          value={values.username}
          onChangeText={(username) => setValues((current) => ({ ...current, username }))}
        />
        <AuthField
          label="Password"
          autoComplete="current-password"
          secure
          value={values.password}
          onChangeText={(password) => setValues((current) => ({ ...current, password }))}
        />
      </View>

      <View style={styles.remember}>
        <AuthCheckbox checked={remember} label="Remember me" onChange={setRemember} />
      </View>

      {message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
      <AuthButton label="Login" onPress={submit} />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Don&apos;t have an account? </Text>
        <Pressable accessibilityRole="link" onPress={onSignup}>
          <Text style={styles.switchLink}>Signup</Text>
        </Pressable>
      </View>
      <Text style={styles.credit}>AniMarket</Text>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { color: '#fff', fontSize: 36, lineHeight: 43, letterSpacing: -1, fontWeight: '700' },
  subtitle: { color: '#fff', fontSize: 15, lineHeight: 23, marginTop: 6, marginBottom: 26 },
  fields: { gap: 18 },
  remember: { marginTop: 12, marginBottom: 25 },
  message: { color: '#fff', backgroundColor: 'rgba(20,31,24,0.5)', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 15 },
  switchText: { color: '#fff', fontSize: 15 },
  switchLink: { color: '#fff', fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  credit: { color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: '700', marginTop: 38 },
});
