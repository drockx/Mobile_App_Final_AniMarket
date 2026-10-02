import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppTextInput } from '@/components/app_text_input';
import { CalendarPicker } from '@/components/calendar_picker';
import { calendarDateKey, isCalendarDateSelectable } from '@/components/calendar_dates';
import { NavigationIcon } from '@/components/navigation_icon';
import { DataFeedback } from '@/components/data_feedback';
import { appColors as c, appFormStyles, appTypography } from '@/constants/app_theme';
import { AccountScreenLayout } from '@/features/profile/presentation/components/account_screen_layout';
import { apiRequest } from '@/services/api';
import { marketReferenceStore, useMarketReferences } from '../market_reference_dependencies';
import { isSourceUrl, observationDate, type LocalMarket, type MarketPrice } from '../domain/market_reference';

type Selection = { market: LocalMarket; price: MarketPrice };
export function MarketPriceEditorScreen({ onSignOut, navigation }: { onSignOut: () => void; navigation: ReactNode }) {
  const data = useMarketReferences();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const latest = data.items.find((market) => market.id === selection?.market.id)?.prices.find((price) => price.id === selection?.price.id);
  function reload() {
    const market = data.items.find((item) => item.id === selection?.market.id);
    if (market && latest) setSelection({ market, price: latest });
  }
  return <AccountScreenLayout title="Admin Portal" subtitle="Maintain sourced Davao del Norte livestock prices. Every edit is saved with its observation date and an admin audit record." onSignOut={onSignOut}>
    {navigation}
    {!!notice && <Text accessibilityLiveRegion="polite" style={s.note}>{notice}</Text>}
    <DataFeedback loading={data.loading} error={data.error} onRetry={marketReferenceStore.retry} />
    <Text style={s.heading}>Choose a reference</Text>
    {data.items.map((market) => <View key={market.id} style={s.card}>
      <Text style={s.heading}>{market.location}</Text>
      {market.prices.map((price) => <Pressable key={price.id} accessibilityRole="button" accessibilityState={{ selected: selection?.market.id === market.id && selection.price.id === price.id, disabled: busy }} disabled={busy} onPress={() => { setNotice(''); setSelection({ market, price }); }} style={[s.option, selection?.market.id === market.id && selection.price.id === price.id && s.selected]}>
        <Text style={s.optionTitle}>{price.name}</Text>
        <Text style={s.note}>{price.min === price.max ? `₱${price.min.toFixed(2)}` : `₱${price.min.toFixed(2)}–₱${price.max.toFixed(2)}`} {price.unit} · {observationDate(price.observedAt)}</Text>
      </Pressable>)}
    </View>)}
    {!data.loading && !data.error && !data.items.length && <Text style={s.note}>No market references have been published.</Text>}
    {selection && <PriceForm key={`${selection.market.id}:${selection.price.id}:${selection.price.revision ?? 1}`} selection={selection} stale={!latest || (latest.revision ?? 1) > (selection.price.revision ?? 1)} onReload={reload} onBusy={setBusy} onSaved={(market, price) => { setSelection({ market, price }); setNotice('Price published. The app receives this update automatically.'); }} />}
  </AccountScreenLayout>;
}

function PriceForm({ selection: { market, price }, stale, onReload, onBusy, onSaved }: {
  selection: Selection; stale: boolean; onReload: () => void; onBusy: (value: boolean) => void; onSaved: (market: LocalMarket, price: MarketPrice) => void;
}) {
  const [statistic, setStatistic] = useState<'average' | 'range'>(price.statistic ?? 'range');
  const [minimum, setMinimum] = useState(price.min.toFixed(2));
  const [maximum, setMaximum] = useState(price.max.toFixed(2));
  const [observedAt, setObservedAt] = useState(price.observedAt ?? '');
  const [sourceName, setSourceName] = useState(price.sourceName ?? '');
  const [sourceUrl, setSourceUrl] = useState(price.sourceUrl ?? '');
  const [notes, setNotes] = useState(price.notes ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const working = useRef(false);
  const active = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; controller.current?.abort(); }; }, []);
  const min = Number(minimum), max = statistic === 'average' ? min : Number(maximum);
  const amount = (value: string) => /^\d+(\.\d{1,2})?$/.test(value.trim()) && Number(value) > 0 && Number(value) <= 1000000;
  const valid = amount(minimum) && (statistic === 'average' || amount(maximum)) && max >= min
    && isCalendarDateSelectable(observedAt, { minDate: price.observedAt, maxDate: calendarDateKey(new Date()) })
    && !!sourceName.trim() && isSourceUrl(sourceUrl.trim()) && confirmed && !stale;
  async function save() {
    if (working.current || !valid) return;
    working.current = true; setBusy(true); onBusy(true); setMessage('');
    controller.current = new AbortController();
    try {
      const result = await apiRequest<{ market: LocalMarket; price: MarketPrice }>(`/admin/market-references/${market.id}/prices/${price.id}`, { method: 'POST', signal: controller.current.signal,
        body: { revision: price.revision ?? 1, min, max, statistic, observedAt, sourceName: sourceName.trim(), sourceUrl: sourceUrl.trim(), notes: notes.trim(), confirmed } });
      if (active.current) { onSaved(result.market, result.price); marketReferenceStore.retry(); }
    } catch (issue) { if (active.current) setMessage(issue instanceof Error ? issue.message : 'Unable to save the reference. Reload before retrying.'); }
    finally { working.current = false; if (active.current) setBusy(false); onBusy(false); }
  }
  function field(label: string, value: string, setter: (value: string) => void, maxLength: number, numeric = false, multiline = false) {
    return <View style={appFormStyles.field}>
      <Text style={s.label}>{label}</Text>
      <AppTextInput accessibilityLabel={label} value={value} onChangeText={(text) => { setter(text); setConfirmed(false); }} editable={!busy} maxLength={maxLength} autoCapitalize={numeric || label.includes('link') ? 'none' : 'sentences'} autoCorrect={!numeric && !label.includes('link')} keyboardType={numeric ? 'decimal-pad' : label.includes('link') ? 'url' : 'default'} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[s.input, multiline && s.textarea]} />
    </View>;
  }
  return <View style={s.card}>
    <Text style={s.heading}>Edit {price.name}</Text>
    <Text style={s.note}>{market.location} · PHP {price.unit}. Use live animal farmgate prices, not retail meat prices. For monthly reports, choose the last day of the reported month and explain the period in the notes.</Text>
    {stale && <View style={s.warning}><Text style={s.note}>This reference changed while you were editing. Your input has been kept; reload the current values before saving.</Text><Pressable accessibilityRole="button" disabled={busy} onPress={onReload} style={s.secondary}><Text style={s.buttonTextDark}>Reload Latest Values</Text></Pressable></View>}
    <Text style={s.label}>Price type</Text>
    <View style={s.choices}>{(['average', 'range'] as const).map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: statistic === value }} disabled={busy} onPress={() => { setStatistic(value); setConfirmed(false); }} style={[s.choice, statistic === value && s.selected]}><Text style={s.optionTitle}>{value === 'average' ? 'Reported average' : 'Reported range'}</Text></Pressable>)}</View>
    {field(statistic === 'average' ? 'Average price (PHP/kg)' : 'Minimum price (PHP/kg)', minimum, setMinimum, 10, true)}
    {statistic === 'range' && field('Maximum price (PHP/kg)', maximum, setMaximum, 10, true)}
    <View style={appFormStyles.field}><Text style={s.label}>Observation date</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => setCalendar(true)} style={s.date}><Text style={s.dateText}>{observedAt ? observationDate(observedAt) : 'Choose date'}</Text><NavigationIcon name="down" /></Pressable></View>
    {field('Source name', sourceName, setSourceName, 150)}
    {field('Public HTTPS source link', sourceUrl, setSourceUrl, 2048)}
    {field('Source notes / reported period', notes, setNotes, 500, false, true)}
    <Text style={s.note}>Keep notes accurate for this source and date. An app entry date does not make an older price a current quote.</Text>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} disabled={busy} onPress={() => setConfirmed(!confirmed)} style={s.confirm}><Text style={s.check}>{confirmed ? '☑' : '☐'}</Text><Text style={s.confirmText}>I checked this price, location and observation date against the linked source.</Text></Pressable>
    {!!message && <Text accessibilityRole="alert" style={s.error}>{message}</Text>}
    {!valid && <Text style={s.note}>Enter positive amounts with up to two decimals, a date at least as recent as the current reference, a source name and HTTPS link, then confirm your check.</Text>}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid || busy }} disabled={!valid || busy} onPress={() => { void save(); }} style={[s.primary, (!valid || busy) && s.disabled]}><Text style={s.buttonText}>{busy ? 'Saving…' : 'Publish Price Update'}</Text></Pressable>
    {calendar && <CalendarPicker title="Price observation date" value={observedAt} minDate={price.observedAt} maxDate={calendarDateKey(new Date())} onSelect={(value) => { setObservedAt(value); setConfirmed(false); setCalendar(false); }} onClose={() => setCalendar(false)} />}
  </View>;
}

const s = StyleSheet.create({
  card: { padding: 14, gap: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: c.line, borderRadius: 14 },
  heading: { ...appTypography.section, color: c.forest },
  note: { ...appTypography.body, color: c.muted },
  label: { ...appFormStyles.label, color: c.text },
  option: { minHeight: 64, padding: 12, gap: 4, borderWidth: 1, borderColor: c.line, borderRadius: 12 },
  optionTitle: { ...appTypography.button, color: c.forest },
  selected: { borderColor: c.forest, backgroundColor: c.mint },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexGrow: 1, flexBasis: 120, minHeight: 52, padding: 12, justifyContent: 'center', borderWidth: 1, borderColor: c.line, borderRadius: 12 },
  input: { ...appFormStyles.control, ...appFormStyles.value, width: '100%', borderColor: c.line, backgroundColor: c.surface, color: c.text },
  textarea: { minHeight: 124 },
  date: { ...appFormStyles.control, borderColor: c.line, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { ...appFormStyles.value, flex: 1, color: c.text },
  confirm: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, backgroundColor: c.mint, alignItems: 'center' },
  check: { fontSize: 24, color: c.forest },
  confirmText: { ...appTypography.body, flex: 1, color: c.text },
  primary: { minHeight: 52, padding: 14, backgroundColor: c.forest, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secondary: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: c.forest, borderRadius: 12, alignItems: 'center' },
  buttonText: { ...appTypography.button, color: '#fff', textAlign: 'center' },
  buttonTextDark: { ...appTypography.button, color: c.forest, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  error: { ...appTypography.body, color: c.danger },
  warning: { padding: 12, gap: 10, borderRadius: 12, backgroundColor: '#fff5de' },
});
