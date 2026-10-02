import { StyleSheet } from 'react-native';
import { appFormStyles } from '@/constants/app_theme';
import { accountColors as c } from './account_screen_layout';

export const verificationStyles = StyleSheet.create({
  card: { padding: 15, gap: 12, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: '#fff' },
  title: { color: c.forest, fontSize: 16, lineHeight: 23, fontWeight: '800' },
  body: { color: c.text, fontSize: 14, lineHeight: 21 },
  note: { color: c.muted, fontSize: 13, lineHeight: 20 },
  label: { ...appFormStyles.label, color: c.forest },
  status: { padding: 13, borderRadius: 12, backgroundColor: '#eaf5ed', gap: 5 },
  error: { color: c.red, backgroundColor: '#fff1ef', padding: 12, borderRadius: 10, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { minHeight: 48, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.forest },
  buttonText: { color: '#fff', fontSize: 14, lineHeight: 21, fontWeight: '800', textAlign: 'center' },
  secondary: { minHeight: 48, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  secondaryText: { color: c.forest, fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  flexButton: { flexGrow: 1, flexShrink: 1, flexBasis: 120, minWidth: 0 },
  disabled: { opacity: 0.5 },
  select: { ...appFormStyles.control, borderColor: c.line, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface },
  selectText: { ...appFormStyles.value, flex: 1, minWidth: 0, color: c.text },
  options: { borderWidth: 1, borderColor: c.line, borderRadius: 11, overflow: 'hidden' },
  option: { minHeight: 48, padding: 12, justifyContent: 'center' },
  selectedOption: { backgroundColor: '#eaf5ed' },
  photo: { width: '100%', aspectRatio: 1.55, borderRadius: 12, backgroundColor: c.surface },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, minHeight: 48 },
  checkbox: { width: 24, height: 24, flexShrink: 0, borderWidth: 1.5, borderRadius: 6, borderColor: c.forest, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: c.forest },
  checkmark: { color: '#fff', fontSize: 16, lineHeight: 20, fontWeight: '800' },
  consentText: { flex: 1, minWidth: 0, color: c.text, fontSize: 13, lineHeight: 20 },
  input: { ...appFormStyles.control, ...appFormStyles.value, minHeight: 96, borderColor: c.line, color: c.text, backgroundColor: c.surface, textAlignVertical: 'top' },
});
