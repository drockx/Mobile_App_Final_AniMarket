import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appColors as colors, appTypography } from '@/constants/app_theme';
import { calendarDateKey, isCalendarDateSelectable, parseCalendarDate, type CalendarDateLimits } from './calendar_dates';
import { NavigationIcon } from './navigation_icon';

export function CalendarPicker({ title, value, onSelect, onClose, helper, minDate, maxDate, excludedDays = [] }: CalendarDateLimits & {
  title: string;
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  helper?: string;
}) {
  const insets = useSafeAreaInsets();
  const { fontScale, width } = useWindowDimensions();
  const limits = { minDate, maxDate, excludedDays };
  const [selected, setSelected] = useState(() => isCalendarDateSelectable(value, limits) ? value : '');
  const [month, setMonth] = useState(() => {
    const today = calendarDateKey(new Date());
    const key = selected || (minDate && today < minDate ? minDate : maxDate && today > maxDate ? maxDate : today);
    const initial = parseCalendarDate(key) ?? new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1, 12);
  });
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days');
  const listDates = fontScale > 1.2 || width < 360;
  const date = parseCalendarDate(selected);
  const year = month.getFullYear();
  const days = new Date(year, month.getMonth() + 1, 0).getDate();
  const leadingDays = month.getDay();
  const firstYear = minDate ? Number(minDate.slice(0, 4)) : Math.min(new Date().getFullYear() - 100, year);
  const lastYear = maxDate ? Number(maxDate.slice(0, 4)) : Math.max(new Date().getFullYear() + 20, year);

  function availableMonth(candidate: Date) {
    const first = calendarDateKey(candidate);
    const last = calendarDateKey(new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0, 12));
    return (!minDate || last >= minDate) && (!maxDate || first <= maxDate);
  }
  const previous = new Date(year, month.getMonth() - 1, 1, 12);
  const next = new Date(year, month.getMonth() + 1, 1, 12);
  const previousEnabled = mode === 'days' && availableMonth(previous);
  const nextEnabled = mode === 'days' && availableMonth(next);

  return <Modal transparent visible animationType="fade" onRequestClose={onClose}>
    <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close calendar" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={styles.sheet}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close calendar" onPress={onClose} style={styles.arrow}><NavigationIcon name="close" /></Pressable>
        </View>
        <ScrollView key={`${mode}-${year}-${month.getMonth()}`} style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          <View style={styles.summary}>
            <Text style={styles.yearSummary}>{date ? date.getFullYear() : 'Select a date'}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.selectedSummary}>{date ? date.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Tap a day on the calendar'}</Text>
          </View>
          <View style={styles.monthRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous month" accessibilityState={{ disabled: !previousEnabled }} disabled={!previousEnabled} onPress={() => setMonth(previous)} style={[styles.arrow, !previousEnabled && styles.disabled]}><NavigationIcon name="back" /></Pressable>
            <View style={styles.monthHeading}>
              <Pressable accessibilityRole="button" accessibilityLabel="Choose month" accessibilityState={{ expanded: mode === 'months' }} onPress={() => setMode(mode === 'months' ? 'days' : 'months')} style={styles.headingButton}><Text style={styles.monthText}>{month.toLocaleDateString('en-PH', { month: 'long' })}</Text><NavigationIcon name={mode === 'months' ? 'up' : 'down'} size={16} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Choose year" accessibilityState={{ expanded: mode === 'years' }} onPress={() => setMode(mode === 'years' ? 'days' : 'years')} style={styles.headingButton}><Text style={styles.monthText}>{year}</Text><NavigationIcon name={mode === 'years' ? 'up' : 'down'} size={16} /></Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Next month" accessibilityState={{ disabled: !nextEnabled }} disabled={!nextEnabled} onPress={() => setMonth(next)} style={[styles.arrow, !nextEnabled && styles.disabled]}><NavigationIcon name="next" /></Pressable>
          </View>
          {mode === 'days' && <View style={listDates ? styles.dateList : styles.grid}>
            {!listDates && ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <Text key={day} style={styles.weekday}>{day}</Text>)}
            {Array.from({ length: leadingDays + days }, (_, index) => {
              if (index < leadingDays) return listDates ? null : <View key={`blank-${index}`} style={styles.cell} />;
              const day = new Date(year, month.getMonth(), index - leadingDays + 1, 12);
              const key = calendarDateKey(day);
              const disabled = !isCalendarDateSelectable(key, limits);
              const active = selected === key;
              return <Pressable key={key} accessibilityRole="button" accessibilityLabel={day.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={() => setSelected(key)} style={listDates ? [styles.listDay, active && styles.selected] : styles.cell}>
                <View style={listDates ? undefined : [styles.dayCircle, active && styles.selected]}><Text style={[styles.dayText, disabled && styles.disabledText, active && styles.selectedText]}>{listDates ? day.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }) : day.getDate()}</Text></View>
              </Pressable>;
            })}
          </View>}
          {mode === 'months' && <View style={styles.options}>
            {Array.from({ length: 12 }, (_, index) => {
              const candidate = new Date(year, index, 1, 12);
              const disabled = !availableMonth(candidate);
              return <Pressable key={index} accessibilityRole="button" accessibilityState={{ selected: index === month.getMonth(), disabled }} disabled={disabled} onPress={() => { setMonth(candidate); setMode('days'); }} style={[styles.monthOption, listDates && styles.fullOption, index === month.getMonth() && styles.selected]}><Text style={[styles.optionText, disabled && styles.disabledText, index === month.getMonth() && styles.selectedText]}>{candidate.toLocaleDateString('en-PH', { month: 'short' })}</Text></Pressable>;
            })}
          </View>}
          {mode === 'years' && Array.from({ length: lastYear - firstYear + 1 }, (_, index) => minDate ? firstYear + index : lastYear - index).map(candidate => <Pressable key={candidate} accessibilityRole="button" accessibilityState={{ selected: candidate === year }} onPress={() => {
            const target = new Date(candidate, month.getMonth(), 1, 12);
            const lower = minDate ? parseCalendarDate(minDate) : null;
            const upper = maxDate ? parseCalendarDate(maxDate) : null;
            const clamped = lower && target < new Date(lower.getFullYear(), lower.getMonth(), 1, 12) ? lower : upper && target > upper ? upper : target;
            setMonth(new Date(clamped.getFullYear(), clamped.getMonth(), 1, 12)); setMode('days');
          }} style={[styles.yearOption, candidate === year && styles.selected]}><Text style={[styles.optionText, candidate === year && styles.selectedText]}>{candidate}</Text></Pressable>)}
          {!!helper && <Text style={styles.helper}>{helper}</Text>}
        </ScrollView>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onClose} style={[styles.button, styles.cancel]}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !isCalendarDateSelectable(selected, limits) }} disabled={!isCalendarDateSelectable(selected, limits)} onPress={() => { onSelect(selected); onClose(); }} style={[styles.button, !isCalendarDateSelectable(selected, limits) && styles.disabled]}><Text style={styles.buttonText}>Confirm Date</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(10,28,20,0.5)' },
  sheet: { width: '100%', maxWidth: 400, maxHeight: '100%', borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 18, paddingRight: 8, paddingVertical: 4 },
  title: { ...appTypography.section, flex: 1, minWidth: 0, color: colors.forest, includeFontPadding: false },
  arrow: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  summary: { paddingHorizontal: 18, paddingVertical: 14, gap: 4, backgroundColor: colors.forest },
  yearSummary: { color: '#d9ede0', fontSize: 14, lineHeight: 20, includeFontPadding: false },
  selectedSummary: { color: '#fff', fontSize: 20, lineHeight: 28, fontWeight: '700', includeFontPadding: false },
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingTop: 8 },
  monthHeading: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 4 },
  headingButton: { minHeight: 44, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 8 },
  monthText: { flexShrink: 1, textAlign: 'center', color: colors.forest, fontSize: 15, lineHeight: 21, fontWeight: '700', includeFontPadding: false },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 10 },
  weekday: { width: '14.2857%', paddingVertical: 8, textAlign: 'center', color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: '600', includeFontPadding: false },
  cell: { width: '14.2857%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 36, minHeight: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  dayText: { color: colors.text, fontSize: 14, lineHeight: 20, textAlign: 'center', includeFontPadding: false },
  dateList: { gap: 4, marginHorizontal: 10 },
  listDay: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10 },
  selected: { backgroundColor: colors.forest },
  selectedText: { color: '#fff', fontWeight: '700' },
  disabledText: { color: '#8b9790' },
  disabled: { opacity: 0.4 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14 },
  monthOption: { flexGrow: 1, flexBasis: '28%', minWidth: 0, minHeight: 48, padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fullOption: { flexBasis: '100%' },
  yearOption: { minHeight: 48, padding: 12, marginHorizontal: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionText: { color: colors.forest, fontSize: 16, lineHeight: 22, textAlign: 'center', includeFontPadding: false },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 12, marginHorizontal: 8 },
  actions: { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: colors.line },
  button: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.forest },
  cancel: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  buttonText: { ...appTypography.button, color: '#fff', textAlign: 'center', includeFontPadding: false },
  cancelText: { ...appTypography.button, color: colors.forest, textAlign: 'center', includeFontPadding: false },
});
