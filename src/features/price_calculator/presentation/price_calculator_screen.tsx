import { KeyboardScrollView } from '@/components/keyboard_scroll_view';
import { AppTextInput as TextInput } from '@/components/app_text_input';
import { NavigationIcon } from '@/components/navigation_icon';
import { useRef, useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMarketReferences, marketReferenceStore } from '@/features/market_reference/market_reference_dependencies';
import { DataFeedback } from '@/components/data_feedback';
import { isDavaoDelNorteLocality, davaoDelNorteLocation } from '@/constants/davao_del_norte';

import { adjustment, categories, estimatePrice, peso, type Category, type Condition, type Province, type Purpose, type ReferenceRates } from '../calculator';

const forest = '#12372a';
const ink = '#1a202c';
const muted = '#718096';
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

type Picker = 'category' | 'sex' | 'purpose' | 'province';
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
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${options.find((option) => option.value === value)?.label ?? value}`} onPress={onPress} style={styles.selectField}>
        <Text numberOfLines={1} style={styles.inputText}>{options.find((option) => option.value === value)?.label ?? value}</Text>
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

export function PriceCalculatorScreen({ initialCategory = 'cattle', initialCity = 'Tagum City', onBack, onUsePrice }: {
  initialCategory?: Category;
  initialCity?: string;
  onBack: () => void;
  onUsePrice: (price: number, category: Category, weight: number) => void;
}) {
  const insets = useSafeAreaInsets();
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
  const [savedResult, setResult] = useState<{ value: PriceResult; basis: string } | null>(null);
  const data = useMarketReferences();

  const locality = city.trim();
  const market = isDavaoDelNorteLocality(locality) ? data.items.find((item) => item.location === davaoDelNorteLocation(locality)) : undefined;
  const price = market?.prices.find((item) => item.category === ({ cattle: 'cow', swine: 'pig', goat: 'goat', poultry: 'poultry' }[category]) && /per kg/i.test(item.unit));
  const rates: ReferenceRates | null = price ? [price.min, price.max] : null;
  const basis = JSON.stringify([market?.id, market?.updatedAt, rates, category, city, province, weight, age, condition, purpose]);
  const result = savedResult?.basis === basis ? savedResult.value : null;
  const categoryLabel = categories.find((item) => item.value === category)?.label.toLowerCase();
  const valid = Number(weight) >= 1 && Number(weight) <= 2000
    && Number(age) >= 1 && Number(age) <= 240 && isDavaoDelNorteLocality(locality) && !!rates && !data.loading && !data.error;
  const pickerOptions = picker === 'category' ? categories : picker === 'sex' ? sexes : picker === 'purpose' ? purposes : provinces;
  const pickerValue = picker === 'category' ? category : picker === 'sex' ? sex : picker === 'purpose' ? purpose : province;

  function change<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setResult(null);
  }

  function choose(value: string) {
    if (picker === 'category') change(setCategory, value as Category);
    if (picker === 'sex') change(setSex, value);
    if (picker === 'purpose') change(setPurpose, value as Purpose);
    if (picker === 'province') change(setProvince, value as Province);
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
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 58 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10} style={styles.backButton}><NavigationIcon name="back" /></Pressable>
        <Text style={styles.headerTitle}>Price Calculator</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
        <Text style={styles.intro}>Estimate a livestock price from live weight, condition and the available regional market reference.</Text>

        <Text style={styles.sectionTitle}>Livestock Information</Text>
        <SelectField label="Livestock Category" value={category} options={categories} onPress={() => setPicker('category')} />

        <View style={styles.row}>
          <View style={styles.rowItem}><NumberField label="Live Weight (kg)" value={weight} decimal onChangeText={(value) => change(setWeight, value)} /></View>
          <View style={styles.rowItem}><NumberField label="Age (months)" value={age} onChangeText={(value) => change(setAge, value)} /></View>
        </View>
        <View style={styles.row}>
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
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <View style={styles.formGroup}>
              <Label>Municipality / City</Label>
              <TextInput accessibilityLabel="Municipality or City" autoCapitalize="words" onChangeText={(value) => change(setCity, value)} style={styles.input} value={city} />
            </View>
          </View>
          <View style={styles.rowItem}><SelectField label="Province" value={province} options={provinces} onPress={() => setPicker('province')} /></View>
        </View>

        <View style={styles.referenceCard}>
          <DataFeedback loading={data.loading} error={data.error} onRetry={marketReferenceStore.retry} />
          <View style={styles.referenceTop}>
            <View style={styles.referenceCopy}>
              <Text style={styles.referenceTitle}>{city}, {province} {categoryLabel} reference</Text>
              <Text style={styles.referenceRate}>{rates ? `${peso(rates[0])}–${peso(rates[1])}/kg` : 'No per-kg reference available'}</Text>
            </View>
            <Text style={styles.referenceBadge}>Local market</Text>
          </View>
          <Text style={styles.referenceMeta}>{market?.sample ? 'Sample prices; confirm current prices with the seller.' : market?.source ?? 'Estimates require a local per-kg market reference.'}</Text>
        </View>

        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid }} disabled={!valid} onPress={calculate} style={[styles.calculateButton, !valid && styles.buttonDisabled]}>
          <Text style={styles.calculateText}>Calculate Estimated Price</Text>
        </Pressable>
        {!valid && <Text style={styles.error}>Use a weight of 1–2,000 kg, an age of 1–240 months, and a Davao del Norte locality with a per-kg reference. You can also set a listing price manually.</Text>}

        {result && (
          <View style={styles.resultSection} onLayout={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>ESTIMATED MARKET VALUE</Text>
              <Text style={styles.resultRange}>{peso(result.minimum)}–{peso(result.maximum)}</Text>
              <Text style={styles.suggested}>Suggested listing price: <Text style={styles.suggestedValue}>{peso(result.suggested)}</Text></Text>
            </View>
            <View style={styles.breakdown}>
              <Text style={styles.breakdownTitle}>Calculation Breakdown</Text>
              <BreakdownRow label="Live weight" value={`${Number(weight).toLocaleString()} kg`} />
              <BreakdownRow label="Local reference" value={rates ? `${peso(rates[0])}–${peso(rates[1])}/kg` : 'Unavailable'} />
              <BreakdownRow label="Body condition" value={adjustment(result.conditionFactor)} />
              <BreakdownRow label="Age adjustment" value={adjustment(result.ageFactor)} />
              <BreakdownRow label="Purpose adjustment" value={adjustment(result.purposeFactor)} />
            </View>
            <View style={styles.resultActions}>
              <Pressable accessibilityRole="button" onPress={() => onUsePrice(result.suggested, category, Number(weight))} style={[styles.resultButton, styles.usePrice]}><Text style={styles.usePriceText}>Use Suggested Price</Text></Pressable>
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
            <Text style={styles.optionTitle}>Choose {picker === 'category' ? 'Livestock Category' : picker === 'sex' ? 'Sex' : picker === 'purpose' ? 'Selling Purpose' : 'Province'}</Text>
            {pickerOptions.map((option) => (
              <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: pickerValue === option.value }} onPress={() => choose(option.value)} style={styles.option}>
                <Text style={[styles.optionText, pickerValue === option.value && styles.optionSelected]}>{option.label}</Text>
                {pickerValue === option.value && <Text style={styles.optionSelected}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#edf2f7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, minWidth: 0, textAlign: 'center', color: forest, fontSize: 17, lineHeight: 23, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingTop: 18 },
  intro: { color: '#5f6f66', fontSize: 11, lineHeight: 16, marginBottom: 14 },
  sectionTitle: { color: forest, fontSize: 14, lineHeight: 19, fontWeight: '800', marginBottom: 12 },
  marketTitle: { marginTop: 1 },
  formGroup: { marginBottom: 16 },
  label: { color: ink, fontSize: 12, lineHeight: 16, fontWeight: '700', marginBottom: 7 },
  required: { color: '#c53030' },
  input: { minHeight: 44, width: '100%', paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: border, borderRadius: 11, backgroundColor: '#f8fafc', color: '#2d3748', fontSize: 14, lineHeight: 20 },
  selectField: { minHeight: 44, paddingHorizontal: 13, borderWidth: 1, borderColor: border, borderRadius: 11, backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center', gap: 5 },
  inputText: { flex: 1, minWidth: 0, color: '#2d3748', fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10 },
  rowItem: { flex: 1, minWidth: 0 },
  conditionRow: { flexDirection: 'row', gap: 7 },
  conditionCard: { flex: 1, minHeight: 62, paddingHorizontal: 4, borderWidth: 1, borderColor: border, borderRadius: 10, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  conditionSelected: { borderColor: forest, borderWidth: 1.5, backgroundColor: '#e7f3ea' },
  conditionTitle: { color: forest, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  conditionDetail: { color: muted, fontSize: 8, lineHeight: 12, marginTop: 3, textAlign: 'center' },
  help: { color: muted, fontSize: 9.5, lineHeight: 13, marginTop: 5 },
  referenceCard: { padding: 13, borderWidth: 1, borderColor: '#c7e5c4', borderRadius: 13, backgroundColor: '#f1f8f3', marginTop: 2, marginBottom: 16 },
  referenceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  referenceCopy: { flex: 1 },
  referenceTitle: { color: '#4a6558', fontSize: 10, lineHeight: 14 },
  referenceRate: { color: forest, fontSize: 15, lineHeight: 20, fontWeight: '800', marginTop: 3 },
  referenceBadge: { color: '#166534', backgroundColor: '#d8eddf', fontSize: 8, lineHeight: 12, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 20 },
  referenceMeta: { color: muted, fontSize: 9, lineHeight: 13, marginTop: 8 },
  calculateButton: { minHeight: 48, borderRadius: 12, backgroundColor: forest, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { backgroundColor: '#9aaba2' },
  calculateText: { color: '#fff', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  error: { color: '#c53030', fontSize: 11, lineHeight: 15, marginTop: 6 },
  resultSection: { marginTop: 18 },
  resultCard: { padding: 18, borderRadius: 17, backgroundColor: forest },
  resultLabel: { color: '#b9d6c1', fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.5 },
  resultRange: { color: '#fff', fontSize: 23, lineHeight: 30, fontWeight: '800', marginTop: 5 },
  suggested: { color: '#fff', fontSize: 11, lineHeight: 19, padding: 9, borderRadius: 10, backgroundColor: '#2d6a4f', marginTop: 8 },
  suggestedValue: { fontSize: 15, fontWeight: '800' },
  breakdown: { marginTop: 12, borderWidth: 1, borderColor: border, borderRadius: 13, overflow: 'hidden' },
  breakdownTitle: { color: forest, backgroundColor: '#f7faf8', fontSize: 12, lineHeight: 17, fontWeight: '700', padding: 12 },
  breakdownRow: { paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#edf2f7', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  breakdownLabel: { color: muted, fontSize: 10, lineHeight: 14 },
  breakdownValue: { color: '#2d3748', fontSize: 10, lineHeight: 14, fontWeight: '700', textAlign: 'right' },
  resultActions: { flexDirection: 'row', gap: 8, marginTop: 11 },
  resultButton: { flex: 1, minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  usePrice: { backgroundColor: forest },
  usePriceText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  editInputs: { borderWidth: 1, borderColor: forest },
  editText: { color: forest, fontSize: 11, fontWeight: '700' },
  disclaimer: { color: '#5f6f66', backgroundColor: '#f7f8fa', fontSize: 9.5, lineHeight: 14, padding: 11, borderRadius: 10, marginTop: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,28,20,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  optionSheet: { width: '100%', maxWidth: 360, padding: 12, borderRadius: 16, backgroundColor: '#fff' },
  optionTitle: { color: forest, fontSize: 16, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 10 },
  option: { minHeight: 48, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#edf2f7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionText: { color: ink, fontSize: 14 },
  optionSelected: { color: forest, fontWeight: '800' },
});
