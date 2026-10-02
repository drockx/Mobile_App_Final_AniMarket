import { useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appColors, appFormStyles } from '@/constants/app_theme';
import { NavigationIcon } from './navigation_icon';

export function AddressSelect({ label, value, options, onSelect, placeholder = 'Select', required = true, error, disabled = false, dark = false, dialogTitle }: {
  label: string; value: string; options: readonly { label: string; value: string }[];
  onSelect: (value: string) => void; placeholder?: string; required?: boolean;
  error?: string; disabled?: boolean; dark?: boolean; dialogTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value)?.label;
  const unavailable = disabled || !options.length;
  return <View style={styles.field}>
    <Text style={[styles.label, dark && styles.lightText]}>{label}{required && <Text style={dark ? styles.lightText : styles.required}> *</Text>}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${selected ?? placeholder}${required ? ', required' : ''}`}
      accessibilityState={{ expanded: open, disabled: unavailable }} accessibilityHint={unavailable ? 'Choose a city or municipality first.' : 'Opens the available choices.'}
      disabled={unavailable} onPress={() => { Keyboard.dismiss(); setOpen(true); }}
      style={[styles.control, dark && styles.darkControl, unavailable && styles.disabled, !!error && (dark ? styles.darkInvalid : styles.invalid)]}>
      <Text style={[styles.value, dark && styles.lightText]}>{selected ?? placeholder}</Text>
      <NavigationIcon name={open ? 'up' : 'down'} color={dark ? '#fff' : appColors.forest} />
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={[styles.error, dark && styles.darkError]}>{error}</Text>}
    <Modal visible={open && !unavailable} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close address choices" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>{dialogTitle ?? label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close address choices" onPress={() => setOpen(false)} style={styles.close}><NavigationIcon name="close" /></Pressable>
          </View>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {options.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: option.value === value }}
              onPress={() => { onSelect(option.value); setOpen(false); }} style={[styles.option, option.value === value && styles.selected]}>
              <Text style={styles.optionText}>{option.label}</Text>
              {option.value === value && <Text style={styles.check}>✓</Text>}
            </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  field: { ...appFormStyles.field },
  label: { ...appFormStyles.label, color: appColors.text },
  required: { color: appColors.danger },
  control: { ...appFormStyles.control, borderColor: '#d9e2dc', backgroundColor: '#fbfdfb', flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { ...appFormStyles.value, flex: 1, minWidth: 0, color: appColors.text },
  lightText: { color: '#fff' },
  darkControl: { borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.78)', backgroundColor: 'rgba(0,0,0,0.24)', paddingHorizontal: 16 },
  disabled: { borderStyle: 'dashed' },
  invalid: { borderColor: appColors.danger },
  darkInvalid: { borderColor: '#ffb4a8' },
  error: { color: appColors.danger, fontSize: 14, lineHeight: 20 },
  darkError: { color: '#ffd2ca' },
  backdrop: { flex: 1, padding: 20, backgroundColor: 'rgba(10,28,20,0.6)', justifyContent: 'center', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 390, maxHeight: '85%', padding: 14, backgroundColor: '#fff', borderRadius: 18 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { flex: 1, minWidth: 0, fontSize: 18, lineHeight: 25, fontWeight: '700', color: appColors.forest },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { flexShrink: 1, maxHeight: 430 },
  option: { minHeight: 48, paddingHorizontal: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: appColors.line },
  optionText: { flex: 1, minWidth: 0, color: appColors.text, fontSize: 16, lineHeight: 22 },
  selected: { backgroundColor: appColors.mint },
  check: { color: appColors.forest, fontSize: 18, fontWeight: '700' },
});
