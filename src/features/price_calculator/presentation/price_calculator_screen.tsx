import { KeyboardScrollView } from '@/components/keyboard_scroll_view';
import { AppTextInput as TextInput } from '@/components/app_text_input';
import { NavigationIcon } from '@/components/navigation_icon';
import { AddressSelect } from '@/components/address_select';
import { useRef, useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMarketReferences, marketReferenceStore } from '@/features/market_reference/market_reference_dependencies';
import { DataFeedback } from '@/components/data_feedback';
import { DAVAO_DEL_NORTE_LOCALITIES, davaoDelNorteLocalityLabel, isDavaoDelNorteLocality, davaoDelNorteLocation } from '@/constants/davao_del_norte';
import { appColors, appFormStyles, appTypography } from '@/constants/app_theme';
import { marketForLocality, observationDate } from '@/features/market_reference/domain/market_reference';

import { adjustment, categories, estimatePrice, peso, type Category, type Condition, type Province, type Purpose, type ReferenceRates } from '../calculator';

const forest = '#12372a';
const ink = '#1a202c';
const muted = appColors.muted;
const border = '#e2e8f0';

const sexes = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'castrated', label: 'Castrated' },
];
const purposes = [
  { value: 'general', label: 'General sale' },
  { value: 'breeding', label: 'Breeding' },
  { value: 'fattening', label: 'Fattening' },
  { value: 'slaughter', label: 'Slaughter' },
  { value: 'dairy', label: 'Dairy' },
];
const provinces = [{ value: 'Davao del Norte', label: 'Davao del Norte' }];
const conditions: { value: Condition; detail: string }[] = [
  { value: 'C', detail: 'Below ideal' },
  { value: 'B', detail: 'Good condition' },
  { value: 'A', detail: 'Prime condition' },
];

type Picker = 'category' | 'sex' | 'purpose' | 'province' | 'reference';
type Option = { value: string; label: string };
type PriceResult = ReturnType<typeof estimatePrice>;

function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}<Text style={styles.required}> *</Text></Text>;
}

function SelectField({ label, value, options, onPress }: {
  label: string;
  value: string;
  options: readonly Option[];
  onPress: () => void;
}) {
  return (
    <View style={styles.formGroup}>
      <Label>{label}</Label>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${options.find((option) => option.value === value)?.label ?? value}`} onPress={() => { Keyboard.dismiss(); onPress(); }} style={styles.selectField}>
        <Text style={styles.inputText}>{options.find((option) => option.value === value)?.label ?? value}</Text>
        <NavigationIcon name="down" />
      </Pressable>
    </View>
  );
}

function NumberField({ label, value, onChangeText, decimal = false }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  decimal?: boolean;
}) {
  return (
    <View style={styles.formGroup}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        onChangeText={(text) => onChangeText(decimal ? text.replace(/[^0-9.]/g, '') : text.replace(/[^0-9]/g, ''))}
        selectTextOnFocus
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>{label}</Text><Text style={styles.breakdownValue}>{value}</Text></View>;
}

function referenceRate(rates: ReferenceRates) {
  const format = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${rates[0] === rates[1] ? format(rates[0]) : `${format(rates[0])}–${format(rates[1])}`}/kg`;
}

export function PriceCalculatorScreen({ initialCategory = 'cattle', initialCity = 'Tagum City', initialPriceId = '', onBack, onUsePrice }: {
  initialCategory?: Category;
  initialCity?: string;
  initialPriceId?: string;
  onBack: () => void;
  onUsePrice: (price: number, category: Category, weight: number, referencePriceId?: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.2;
  const scrollRef = useRef<ScrollView>(null);
  const [category, setCategory] = useState<Category>(initialCategory);
  const [weight, setWeight] = useState('450');
  const [age, setAge] = useState('24');
  const [sex, setSex] = useState('male');
  const [purpose, setPurpose] = useState<Purpose>('general');
  const [condition, setCondition] = useState<Condition>('B');
  const [city, setCity] = useState(initialCity);
  const [province, setProvince] = useState<Province>('Davao del Norte');
  const [picker, setPicker] = useState<Picker | null>(null);
  const [priceId, setPriceId] = useState(initialPriceId);
  const [savedResult, setResult] = useState<{ value: PriceResult; basis: string } | null>(null);
  const data = useMarketReferences();

  const locality = city.trim();
  const market = isDavaoDelNorteLocality(locality) ? marketForLocality(data.items, davaoDelNorteLocation(locality)) : undefined;
  const referencePrices = market?.prices.filter((item) => item.category === ({ cattle: 'cow', swine: 'pig', goat: 'goat', poultry: 'poultry' }[category]) && /per kg/i.test(item.unit)) ?? [];
  const price = referencePrices.find((item) => item.id === priceId) ?? referencePrices[0];
  const referenceOptions = referencePrices.map((item) => ({ value: item.id, label: item.name }));
  const rates: ReferenceRates | null = price ? [price.min, price.max] : null;
  const basis = JSON.stringify([market?.id, market?.updatedAt, price?.id, rates, category, city, province, weight, age, condition, purpose]);
  const result = savedResult?.basis === basis ? savedResult.value : null;
  const valid = Number(weight) >= 1 && Number(weight) <= 2000
    && Number(age) >= 1 && Number(age) <= 240 && isDavaoDelNorteLocality(locality) && !!rates && !data.loading && !data.error;
  const pickerOptions = picker === 'category' ? categories : picker === 'sex' ? sexes : picker === 'purpose' ? purposes : picker === 'reference' ? referenceOptions : provinces;
  const pickerValue = picker === 'category' ? category : picker === 'sex' ? sex : picker === 'purpose' ? purpose : picker === 'reference' ? price?.id : province;

  function change<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setResult(null);
  }

  function choose(value: string) {
    if (picker === 'category') change(setCategory, value as Category);
    if (picker === 'sex') change(setSex, value);
    if (picker === 'purpose') change(setPurpose, value as Purpose);
    if (picker === 'province') change(setProvince, value as Province);
    if (picker === 'reference') change(setPriceId, value);
    setPicker(null);
  }

  function calculate() {
    if (!valid) return;
    Keyboard.dismiss();
    setResult({ value: estimatePrice({ category, province, weight: Number(weight), age: Number(age), condition, purpose }, rates), basis });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 8, minHeight: insets.top + 64 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10} style={styles.backButton}><NavigationIcon name="back" /></Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>Price Calculator</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
        <Text style={styles.intro}>Estimate a livestock price from live weight, condition and the available regional market reference.</Text>

        <Text style={styles.sectionTitle}>Livestock Information</Text>
        <SelectField label="Livestock Category" value={category} options={categories} onPress={() => setPicker('category')} />

        <View style={[styles.row, compact && styles.stackedRow]}>
          <View style={styles.rowItem}><NumberField label="Live Weight (kg)" value={weight} decimal onChangeText={(value) => change(setWeight, value)} /></View>
          <View style={styles.rowItem}><NumberField label="Age (months)" value={age} onChangeText={(value) => change(setAge, value)} /></View>
        </View>
        <View style={[styles.row, compact && styles.stackedRow]}>
          <View style={styles.rowItem}><SelectField label="Sex" value={sex} options={sexes} onPress={() => setPicker('sex')} /></View>
          <View style={styles.rowItem}><SelectField label="Selling Purpose" value={purpose} options={purposes} onPress={() => setPicker('purpose')} /></View>
        </View>

        <View style={styles.formGroup}>
          <Label>Body Condition</Label>
          <View style={styles.conditionRow}>
            {conditions.map((option) => (
              <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={`Grade ${option.value}, ${option.detail}`} accessibilityState={{ checked: condition === option.value }} onPress={() => change(setCondition, option.value)} style={[styles.conditionCard, condition === option.value && styles.conditionSelected]}>
                <Text style={styles.conditionTitle}>Grade {option.value}</Text>
                <Text style={styles.conditionDetail}>{option.detail}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.help}>Use the grade that best matches the animal&apos;s present physical condition.</Text>
        </View>

        <Text style={[styles.sectionTitle, styles.marketTitle]}>Market Location</Text>
        <View style={[styles.row, compact && styles.stackedRow]}>
          <View style={styles.rowItem}>
            <View style={styles.formGroup}>
              <AddressSelect label="Municipality / City" value={city} options={DAVAO_DEL_NORTE_LOCALITIES.map((name) => ({ label: davaoDelNorteLocalityLabel(name), value: name }))} onSelect={(value) => change(setCity, value)} placeholder="Choose city or municipality" />
            </View>
          </View>
          <View style={styles.rowItem}><SelectField label="Province" value={province} options={provinces} onPress={() => setPicker('province')} /></View>
        </View>

        <View style={styles.referenceCard}>
          <DataFeedback loading={data.loading} error={data.error} onRetry={marketReferenceStore.retry} />
          {referencePrices.length > 1 && <SelectField label="Price Reference" value={price?.id ?? ''} options={referenceOptions} onPress={() => setPicker('reference')} />}
          <View style={[styles.referenceTop, compact && styles.stackedRow]}>
            <View style={styles.referenceCopy}>
              <Text style={styles.referenceTitle}>{price?.name ?? 'Livestock'} · {market?.location ?? province}</Text>
              <Text style={styles.referenceRate}>{rates ? `${referenceRate(rates)} live weight` : 'No per-kg reference available'}</Text>
            </View>
            <Text style={styles.referenceBadge}>{price?.statistic === 'average' ? 'Reported average' : 'Reported range'}</Text>
          </View>
          <Text style={styles.referenceMeta}>{market?.sample ? 'Sample prices; confirm current prices with the seller.' : price?.sourceName ?? market?.source ?? 'Estimates require a local per-kg market reference.'}</Text>
          {!!price && <Text style={styles.referenceMeta}>Observed {observationDate(price.observedAt)}. Confirm current prices with the seller. Age, condition and purpose adjustments are app estimates.</Text>}
        </View>

        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid }} disabled={!valid} onPress={calculate} style={[styles.calculateButton, !valid && styles.buttonDisabled]}>
          <Text style={styles.calculateText}>Calculate Estimated Price</Text>
        </Pressable>
        {!valid && <Text style={styles.error}>Use a weight of 1–2,000 kg, an age of 1–240 months, and a Davao del Norte locality with a per-kg reference. You can also set a listing price manually.</Text>}

        {result && (
          <View style={styles.resultSection} onLayout={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>ESTIMATED MARKET VALUE</Text>
              <Text style={styles.resultRange}>{result.minimum === result.maximum ? peso(result.minimum) : `${peso(result.minimum)}–${peso(result.maximum)}`}</Text>
              <Text style={styles.suggested}>Suggested listing price: <Text style={styles.suggestedValue}>{peso(result.suggested)}</Text></Text>
            </View>
            <View style={styles.breakdown}>
              <Text style={styles.breakdownTitle}>Calculation Breakdown</Text>
              <BreakdownRow label="Live weight" value={`${Number(weight).toLocaleString()} kg`} />
              <BreakdownRow label="Local reference" value={rates ? referenceRate(rates) : 'Unavailable'} />
              <BreakdownRow label="Body condition" value={adjustment(result.conditionFactor)} />
              <BreakdownRow label="Age adjustment" value={adjustment(result.ageFactor)} />
              <BreakdownRow label="Purpose adjustment" value={adjustment(result.purposeFactor)} />
            </View>
            <View style={[styles.resultActions, compact && styles.stackedRow]}>
              <Pressable accessibilityRole="button" onPress={() => onUsePrice(result.suggested, category, Number(weight), price?.id)} style={[styles.resultButton, styles.usePrice]}><Text style={styles.usePriceText}>Use Suggested Price</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setResult(null); scrollRef.current?.scrollTo({ y: 0, animated: true }); }} style={[styles.resultButton, styles.editInputs]}><Text style={styles.editText}>Edit Inputs</Text></Pressable>
            </View>
            <Text style={styles.disclaimer}>This is an advisory market estimate, not a guaranteed selling price. Actual value may vary after inspection, negotiation, documentation review, transport arrangements and changes in local demand.</Text>
          </View>
        )}
      </KeyboardScrollView>

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={() => setPicker(null)} style={StyleSheet.absoluteFill} />
          <View style={styles.optionSheet}>
            <Text style={styles.optionTitle}>Choose {picker === 'category' ? 'Livestock Category' : picker === 'sex' ? 'Sex' : picker === 'purpose' ? 'Selling Purpose' : picker === 'reference' ? 'Price Reference' : 'Province'}</Text>
            <ScrollView style={styles.optionList} keyboardShouldPersistTaps="handled">
              {pickerOptions.map((option) => (
                <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: pickerValue === option.value }} onPress={() => choose(option.value)} style={styles.option}>
                  <Text style={[styles.optionText, pickerValue === option.value && styles.optionSelected]}>{option.label}</Text>
                  {pickerValue === option.value && <Text style={styles.optionSelected}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#edf2f7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...appTypography.title, flex: 1, minWidth: 0, textAlign: 'center', color: forest },
  content: { paddingHorizontal: 20, paddingTop: 18 },
  intro: { ...appTypography.body, color: muted, marginBottom: 18 },
  sectionTitle: { ...appTypography.section, color: forest, marginBottom: 12 },
  marketTitle: { marginTop: 1 },
  formGroup: { marginBottom: 16 },
  label: { ...appFormStyles.label, color: ink, marginBottom: 8 },
  required: { color: '#c53030' },
  input: { ...appFormStyles.control, ...appFormStyles.value, width: '100%', borderColor: border, backgroundColor: '#f8fafc', color: '#2d3748' },
  selectField: { ...appFormStyles.control, borderColor: border, backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputText: { ...appFormStyles.value, flex: 1, minWidth: 0, color: '#2d3748' },
  row: { flexDirection: 'row', gap: 10 },
  stackedRow: { flexDirection: 'column' },
  rowItem: { flex: 1, minWidth: 0 },
  conditionRow: { flexDirection: 'row', gap: 7 },
  conditionCard: { flex: 1, minHeight: 78, paddingHorizontal: 4, paddingVertical: 10, borderWidth: 1, borderColor: border, borderRadius: 10, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  conditionSelected: { borderColor: forest, borderWidth: 1.5, backgroundColor: '#e7f3ea' },
  conditionTitle: { color: forest, fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  conditionDetail: { color: muted, fontSize: 13, lineHeight: 18, marginTop: 3, textAlign: 'center' },
  help: { color: muted, fontSize: 13, lineHeight: 19, marginTop: 7 },
  referenceCard: { padding: 13, borderWidth: 1, borderColor: '#c7e5c4', borderRadius: 13, backgroundColor: '#f1f8f3', marginTop: 2, marginBottom: 16 },
  referenceTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  referenceCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  referenceTitle: { color: '#4a6558', fontSize: 14, lineHeight: 20 },
  referenceRate: { color: forest, fontSize: 15, lineHeight: 21, fontWeight: '800', marginTop: 3 },
  referenceBadge: { alignSelf: 'flex-start', maxWidth: '100%', flexShrink: 1, color: '#166534', backgroundColor: '#d8eddf', fontSize: 13, lineHeight: 18, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  referenceMeta: { color: muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  calculateButton: { minHeight: 50, padding: 12, borderRadius: 12, backgroundColor: forest, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { backgroundColor: '#9aaba2' },
  calculateText: { ...appTypography.button, color: '#fff', textAlign: 'center' },
  error: { color: '#b42318', fontSize: 13, lineHeight: 19, marginTop: 8 },
  resultSection: { marginTop: 18 },
  resultCard: { padding: 18, borderRadius: 17, backgroundColor: forest },
  resultLabel: { color: '#b9d6c1', fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.5 },
  resultRange: { color: '#fff', fontSize: 23, lineHeight: 30, fontWeight: '800', marginTop: 5 },
  suggested: { color: '#fff', fontSize: 14, lineHeight: 21, padding: 9, borderRadius: 10, backgroundColor: '#2d6a4f', marginTop: 8 },
  suggestedValue: { fontSize: 15, lineHeight: 21, fontWeight: '800' },
  breakdown: { marginTop: 12, borderWidth: 1, borderColor: border, borderRadius: 13, overflow: 'hidden' },
  breakdownTitle: { color: forest, backgroundColor: '#f7faf8', fontSize: 16, lineHeight: 22, fontWeight: '700', padding: 12 },
  breakdownRow: { paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#edf2f7', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  breakdownLabel: { flex: 1, color: muted, fontSize: 14, lineHeight: 20 },
  breakdownValue: { flex: 1, color: '#2d3748', fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'right' },
  resultActions: { flexDirection: 'row', gap: 8, marginTop: 11 },
  resultButton: { flex: 1, minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 12 },
  usePrice: { backgroundColor: forest },
  usePriceText: { ...appTypography.button, color: '#fff', textAlign: 'center' },
  editInputs: { borderWidth: 1, borderColor: forest },
  editText: { ...appTypography.button, color: forest, textAlign: 'center' },
  disclaimer: { color: muted, backgroundColor: '#f7f8fa', fontSize: 13, lineHeight: 19, padding: 11, borderRadius: 10, marginTop: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,28,20,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  optionSheet: { width: '100%', maxWidth: 360, maxHeight: '85%', padding: 12, borderRadius: 16, backgroundColor: '#fff' },
  optionList: { flexShrink: 1 },
  optionTitle: { color: forest, fontSize: 16, lineHeight: 22, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 10 },
  option: { minHeight: 48, paddingHorizontal: 10, paddingVertical: 10, gap: 8, borderTopWidth: 1, borderTopColor: '#edf2f7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionText: { flex: 1, minWidth: 0, color: ink, fontSize: 14, lineHeight: 20 },
  optionSelected: { color: forest, fontWeight: '800' },
});
