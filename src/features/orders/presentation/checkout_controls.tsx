import { AppTextInput as TextInput } from '@/components/app_text_input';
import { NavigationIcon } from '@/components/navigation_icon';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { dateKey, parseDate, tomorrowKey } from '../domain/checkout';

export const checkoutColors = { green: '#12372a', mid: '#2d6a4f', mint: '#eaf5ed', line: '#dfe8e2', text: '#17221d', muted: '#52647a', warn: '#fff8e7', warnLine: '#f2dfae', danger: '#b42318' };
export const checkoutIcons = {
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  truck: { ios: 'truck.box', android: 'local_shipping', web: 'local_shipping' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  payment: { ios: 'creditcard', android: 'credit_card', web: 'credit_card' },
  phone: { ios: 'phone', android: 'call', web: 'call' },
  chat: { ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' },
} as const;

export function CheckoutButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [controlStyles.button, secondary && controlStyles.secondary, disabled && controlStyles.buttonDisabled, pressed && { opacity: 0.75 }]}><Text style={[controlStyles.buttonText, secondary && { color: checkoutColors.green }]}>{label}</Text></Pressable>;
}

export function CheckoutSheet({ title, visible, onClose, children }: { title: string; visible: boolean; onClose: () => void; children: ReactNode }) {
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <View style={controlStyles.backdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={controlStyles.sheet}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={controlStyles.sheetContent}>
          <Text accessibilityRole="header" style={controlStyles.sheetTitle}>{title}</Text>
          {children}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

export function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return <Text style={controlStyles.label}>{label}{required && <Text style={controlStyles.required}> *</Text>}</Text>;
}

export function FieldError({ message }: { message?: string }) {
  return message ? <Text accessibilityRole="alert" style={controlStyles.error}>{message}</Text> : null;
}

export function CheckoutField({ label, value, onChangeText, placeholder, required, error, multiline, keyboardType, maxLength, autoComplete }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; required?: boolean;
  error?: string; multiline?: boolean; keyboardType?: ComponentProps<typeof TextInput>['keyboardType']; maxLength?: number;
  autoComplete?: ComponentProps<typeof TextInput>['autoComplete'];
}) {
  return <View style={controlStyles.field}>
    <FieldLabel label={label} required={required} />
    <TextInput accessibilityLabel={`${label}${required ? ', required' : ''}`} value={value} onChangeText={onChangeText}
      placeholder={placeholder} placeholderTextColor={checkoutColors.muted} keyboardType={keyboardType} multiline={multiline}
      maxLength={maxLength} autoComplete={autoComplete} textAlignVertical={multiline ? 'top' : 'center'}
      style={[controlStyles.input, multiline && controlStyles.multiline, !!error && controlStyles.invalid]} />
    <FieldError message={error} />
  </View>;
}

export function CheckoutSelect({ label, value, options, onSelect, placeholder, required, error, hideLabel }: {
  label: string; value: string; options: readonly { label: string; value: string }[]; onSelect: (value: string) => void;
  placeholder?: string; required?: boolean; error?: string; hideLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value)?.label;
  return <View style={!hideLabel && controlStyles.field}>
    {!hideLabel && <FieldLabel label={label} required={required} />}
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${selected ?? placeholder ?? 'Select'}${required ? ', required' : ''}`} onPress={() => setOpen(true)} style={[controlStyles.input, controlStyles.select, !!error && controlStyles.invalid]}>
      <Text style={controlStyles.inputText}>{selected ?? placeholder ?? 'Select'}</Text><NavigationIcon name={open ? 'up' : 'down'} />
    </Pressable>
    <FieldError message={error} />
    <CheckoutSheet title={label} visible={open} onClose={() => setOpen(false)}>
      {options.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} onPress={() => { onSelect(option.value); setOpen(false); }} style={controlStyles.option}>
        <Text style={[controlStyles.optionText, value === option.value && controlStyles.optionSelected]}>{option.label}</Text>
        {value === option.value && <Text style={controlStyles.optionSelected}>✓</Text>}
      </Pressable>)}
      <CheckoutButton secondary label="Cancel" onPress={() => setOpen(false)} />
    </CheckoutSheet>
  </View>;
}

export function CheckoutDate({ label, value, onSelect, error, excludedDays = [] }: { label: string; value: string; onSelect: (value: string) => void; error?: string; excludedDays?: readonly number[] }) {
  const { fontScale } = useWindowDimensions();
  const listDates = fontScale > 1.3;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const initial = parseDate(value || tomorrowKey())!;
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const minimum = tomorrowKey();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const canGoBack = dateKey(month).slice(0, 7) > minimum.slice(0, 7);
  const selected = parseDate(value);
  function showCalendar() {
    const initial = parseDate(value >= minimum ? value : minimum)!;
    setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1)); setOpen(true);
  }
  return <View style={controlStyles.field}>
    <FieldLabel label={label} required />
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${selected ? selected.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : 'choose date'}, required`} onPress={showCalendar} style={[controlStyles.input, controlStyles.select, !!error && controlStyles.invalid]}>
      <Text style={controlStyles.inputText}>{selected ? selected.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'mm/dd/yyyy'}</Text><SymbolView name={checkoutIcons.calendar} size={16} tintColor={checkoutColors.green} />
    </Pressable>
    <FieldError message={error} />
    <CheckoutSheet title={label} visible={open} onClose={() => setOpen(false)}>
      <View style={controlStyles.monthRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" accessibilityState={{ disabled: !canGoBack }} disabled={!canGoBack} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={[controlStyles.monthArrow, !canGoBack && { opacity: 0.3 }]}><NavigationIcon name="back" /></Pressable>
        <Text accessibilityLiveRegion="polite" style={controlStyles.monthName}>{month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={controlStyles.monthArrow}><NavigationIcon name="next" size={24} /></Pressable>
      </View>
      <View style={listDates ? controlStyles.calendarList : controlStyles.calendar}>
        {!listDates && ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <Text key={day} style={controlStyles.weekday}>{day}</Text>)}
        {Array.from({ length: firstDay + days }, (_, index) => {
          if (index < firstDay) return listDates ? null : <View key={`blank-${index}`} style={controlStyles.dateCell} />;
          const day = new Date(month.getFullYear(), month.getMonth(), index - firstDay + 1, 12);
          const key = dateKey(day);
          const disabled = key < minimum || excludedDays.includes(day.getDay());
          return <Pressable key={key} accessibilityRole="button" accessibilityLabel={day.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} accessibilityState={{ selected: key === value, disabled }} disabled={disabled} onPress={() => { onSelect(key); setOpen(false); }} style={listDates ? [controlStyles.listDate, key === value && controlStyles.selectedDay] : controlStyles.dateCell}>
            {listDates ? <Text style={[controlStyles.listDateText, disabled && controlStyles.disabledDay, key === value && { color: '#fff' }]}>{day.toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' })}{key === value ? ' ✓' : ''}</Text> :
              <View style={[controlStyles.dayCircle, key === value && controlStyles.selectedDay]}><Text style={[controlStyles.dayText, disabled && controlStyles.disabledDay, key === value && { color: '#fff' }]}>{day.getDate()}</Text></View>}
          </Pressable>;
        })}
      </View>
      <Text style={controlStyles.calendarHelp}>Choose a date from tomorrow onward{excludedDays.includes(0) ? '. The seller is unavailable on Sundays.' : '.'}</Text>
      <CheckoutButton secondary label="Cancel" onPress={() => setOpen(false)} />
    </CheckoutSheet>
  </View>;
}

const controlStyles = StyleSheet.create({
  field: { marginTop: 12 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: checkoutColors.text, marginBottom: 7 },
  required: { color: checkoutColors.danger },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#d9e2dc', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, backgroundColor: '#fbfdfb', color: checkoutColors.text, fontSize: 14, lineHeight: 20 },
  inputText: { flex: 1, minWidth: 0, color: checkoutColors.text, fontSize: 14, lineHeight: 20 },
  multiline: { minHeight: 96 },
  select: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  invalid: { borderColor: checkoutColors.danger },
  error: { color: checkoutColors.danger, fontSize: 13, lineHeight: 18, marginTop: 6 },
  button: { minHeight: 50, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: checkoutColors.green, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800', textAlign: 'center' },
  buttonDisabled: { backgroundColor: '#687a70' },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: checkoutColors.line },
  backdrop: { flex: 1, backgroundColor: '#12372a70', padding: 16, justifyContent: 'center', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 390, maxHeight: '85%', backgroundColor: '#fff', borderRadius: 18 },
  sheetContent: { padding: 18, gap: 12 },
  sheetTitle: { color: checkoutColors.green, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  option: { minHeight: 48, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: checkoutColors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  optionText: { flex: 1, minWidth: 0, color: checkoutColors.text, fontSize: 14, lineHeight: 20 },
  optionSelected: { color: checkoutColors.green, fontWeight: '700' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  monthArrow: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  monthName: { flex: 1, minWidth: 0, color: checkoutColors.green, fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  calendar: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', paddingVertical: 8, textAlign: 'center', fontSize: 12, lineHeight: 16, color: checkoutColors.muted, fontWeight: '700' },
  dateCell: { width: '14.2857%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { minWidth: 34, maxWidth: '100%', minHeight: 36, paddingHorizontal: 2, paddingVertical: 4, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, lineHeight: 20, color: checkoutColors.text },
  calendarList: { gap: 4 },
  listDate: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10 },
  listDateText: { fontSize: 14, lineHeight: 20, color: checkoutColors.text },
  disabledDay: { color: '#a8b2ab' },
  selectedDay: { backgroundColor: checkoutColors.green },
  calendarHelp: { color: checkoutColors.muted, fontSize: 13, lineHeight: 18 },
});
