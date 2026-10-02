import { KeyboardScrollView } from '@/components/keyboard_scroll_view';
import { AppTextInput as TextInput } from '@/components/app_text_input';
import { CalendarPicker } from '@/components/calendar_picker';
import { calendarDateKey, isCalendarDateSelectable } from '@/components/calendar_dates';
import { NavigationIcon } from '@/components/navigation_icon';
import { useMemo, useRef, useState } from 'react';
import { createRecordId } from '@/services/development_data';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appFormStyles, appTypography } from '@/constants/app_theme';

import {
  DAVAO_DEL_NORTE, DAVAO_DEL_NORTE_LOCALITIES, davaoDelNorteLocalityLabel, davaoDelNorteLocation,
  type DavaoDelNorteLocality,
} from '@/constants/davao_del_norte';
import { useMarketReferences } from '@/features/market_reference/market_reference_dependencies';
import { listingLocality, locationIssue, type SelectedLocation } from '@/features/location/domain/location';
import { LocationPicker } from '@/features/location/presentation/location_picker';

import type { MarketplaceService } from '../application/marketplace_service';
import type { Listing, ListingPriceUnit, LivestockCategory } from '../domain/listing';

const colors = {
  forest: '#12372a', ink: '#1a202c', muted: '#64748b', line: '#e2e8f0',
  input: '#f8fafc', mint: '#e8f4eb', red: '#c53030',
};
const categories: { label: string; value: LivestockCategory }[] = [
  { label: 'Cow', value: 'Cow' }, { label: 'Pig', value: 'Pig' },
  { label: 'Goat', value: 'Goat' }, { label: 'Chicken', value: 'Chicken' },
];
type VaccinationStatus = 'vaccinated' | 'not-vaccinated' | 'unknown';
type IconName = React.ComponentProps<typeof SymbolView>['name'];
const icons = {
  camera: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  photo: { ios: 'photo', android: 'image', web: 'image' },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
} as const;

function Icon({ name, size = 19, color = colors.forest }: { name: IconName; size?: number; color?: string }) {
  return <SymbolView name={name} size={size} tintColor={color} />;
}

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}

function Label({ children, required = false }: { children: string; required?: boolean }) {
  return <Text style={styles.label}>{children}{required && <Text style={styles.required}> *</Text>}</Text>;
}

function Field({
  label, required, value, onChangeText, placeholder, keyboardType = 'default', multiline = false,
}: {
  label: string; required?: boolean; value: string; onChangeText: (value: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'decimal-pad' | 'number-pad'; multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Label required={required}>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#52645a"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.textArea]}
      />
    </View>
  );
}

function SelectField({ label, value, options, onSelect }: {
  label: string; value: string; options: { label: string; value: string }[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value)?.label ?? value;
  return (
    <View style={styles.field}>
      <Label required>{label}</Label>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${selected}`} accessibilityState={{ expanded: open }} onPress={() => { Keyboard.dismiss(); setOpen(true); }} style={[styles.input, styles.select]}>
        <Text style={styles.inputText}>{selected}</Text>
        <NavigationIcon name={open ? 'up' : 'down'} />
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.optionSheet}>
            <Text style={styles.optionTitle}>{label}</Text>
            <ScrollView style={styles.optionList} keyboardShouldPersistTaps="handled">
              {options.map((option) => (
                <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: value === option.value }} onPress={() => { onSelect(option.value); setOpen(false); }} style={styles.option}>
                  <Text style={[styles.optionText, value === option.value && styles.optionSelected]}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function peso(value: number) {
  return `₱${Math.round(value).toLocaleString('en-PH')}`;
}

function validDate(value: string) {
  return isCalendarDateSelectable(value, { maxDate: calendarDateKey(new Date()) });
}

export function CreateListingScreen({ marketplace, initialDraft, initialPickup, initialPrice = '', initialCategory = 'Cow', initialWeight = '', initialTitle = '', initialPriceUnit = 'per head', onClose, onPublished, onMarketReference }: {
  marketplace: MarketplaceService;
  initialDraft?: Listing;
  initialPickup?: SelectedLocation | null;
  initialPrice?: string;
  initialCategory?: LivestockCategory;
  initialWeight?: string;
  initialTitle?: string;
  initialPriceUnit?: ListingPriceUnit;
  onClose: () => void;
  onPublished: (id: string) => void;
  onMarketReference: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const stackedFields = width < 360 || fontScale > 1.1;
  const [photos, setPhotos] = useState<string[]>(initialDraft?.imageUris ?? (initialDraft?.imageUri ? [initialDraft.imageUri] : []));
  const [title, setTitle] = useState(initialDraft?.title ?? initialTitle);
  const [category, setCategory] = useState<LivestockCategory>(initialDraft?.category ?? initialCategory);
  const [age, setAge] = useState(initialDraft?.age ?? '');
  const [weight, setWeight] = useState(initialDraft?.weight.replace(/\s*kg$/i, '') ?? initialWeight);
  const [vaccination, setVaccination] = useState<VaccinationStatus>(initialDraft ? initialDraft.health === 'Vaccinated' ? 'vaccinated' : initialDraft.health === 'Not vaccinated' ? 'not-vaccinated' : 'unknown' : 'vaccinated');
  const [vaccinationDate, setVaccinationDate] = useState(initialDraft?.vaccinationDate ?? '');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [vaccineName, setVaccineName] = useState(initialDraft?.vaccineName ?? '');
  const [proof, setProof] = useState<{ name: string; uri: string } | null>(initialDraft?.vaccinationProof ?? null);
  const [city, setCity] = useState<DavaoDelNorteLocality>(listingLocality(initialDraft?.location.split(',')[0]) ?? 'Tagum City');
  const [streetPurok, setStreetPurok] = useState(initialDraft?.streetPurok ?? '');
  const [barangay, setBarangay] = useState(initialDraft?.barangay ?? '');
  const [pickupLocation, setPickupLocation] = useState<SelectedLocation | null>(initialPickup ?? null);
  const pickupPin = pickupLocation?.coordinate;
  const [price, setPrice] = useState(initialDraft?.price ? String(initialDraft.price) : initialPrice);
  const [priceUnit, setPriceUnit] = useState<ListingPriceUnit>(initialDraft?.priceUnit ?? initialPriceUnit);
  const [description, setDescription] = useState(initialDraft?.description ?? '');
  const [descriptionHeight, setDescriptionHeight] = useState(120);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);
  const [operationId] = useState(createRecordId);
  const referenceData = useMarketReferences();

  const reference = useMemo(() => {
    const market = referenceData.items.find((item) => item.location === davaoDelNorteLocation(city));
    const marketCategory = { Cow: 'cow', Goat: 'goat', Pig: 'pig', Chicken: 'poultry' }[category];
    const rate = market?.prices.find((item) => item.category === marketCategory);
    const kg = Number(weight);
    const perKg = rate?.unit.toLowerCase().includes('per kg') ?? false;
    const suggested = rate && perKg && !referenceData.loading && !referenceData.error && Number.isFinite(kg) && kg > 0
      ? Math.max(100, Math.round((kg * (rate.min + rate.max) / 2) / 500) * 500) : null;
    return { market, rate, perKg, kg, suggested };
  }, [category, city, weight, referenceData]);

  async function addPhotos() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 4 - photos.length,
        quality: 0.85,
      });
      if (!result.canceled) setPhotos((current) => [...current, ...result.assets.map((asset) => asset.uri)].slice(0, 4));
    } catch {
      showMessage('Photos unavailable', 'Please try choosing photos again.');
    }
  }

  async function addProof() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true,
      });
      if (!result.canceled) setProof({ name: result.assets[0].name, uri: result.assets[0].uri });
    } catch {
      showMessage('File unavailable', 'Please try attaching the vaccination proof again.');
    }
  }

  function selectPickup(location: SelectedLocation) {
    const locality = listingLocality(location.address?.city);
    setPickupLocation(location);
    if (locality) setCity(locality);
    if (location.address?.street || (locality && locality !== city)) setStreetPurok(location.address?.street ?? '');
    if (location.address?.barangay || (locality && locality !== city)) setBarangay(location.address?.barangay ?? '');
    setError('');
  }

  function listingInput(): Omit<Listing, 'id'> {
    return {
      title: title.trim(), category, details: `${age.trim() || 'Age not specified'} · ${weight.trim()} kg`,
      price: Number(price), priceUnit, verified: false, location: davaoDelNorteLocation(city),
      streetPurok: streetPurok.trim(), barangay: barangay.trim(),
      weight: `${weight.trim()} kg`, age: age.trim(),
      health: vaccination === 'vaccinated' ? 'Vaccinated' : vaccination === 'not-vaccinated' ? 'Not vaccinated' : 'Unknown',
      healthVerification: { status: 'unverified' }, description: description.trim(),
      imageUri: photos[0], imageUris: photos, vaccinationProof: proof ?? undefined, vaccinationDate, vaccineName,
    };
  }
  async function publish() {
    if (publishingRef.current) return;
    let problem = '';
    if (!photos.length) problem = 'Add at least one livestock photo.';
    else if (!title.trim()) problem = 'Enter a listing title.';
    else if (!Number.isFinite(Number(weight)) || Number(weight) <= 0) problem = 'Enter a valid weight in kilograms.';
    else if (vaccination === 'vaccinated' && !validDate(vaccinationDate)) problem = 'Choose a valid vaccination date on or before today.';
    else if (vaccination === 'vaccinated' && !vaccineName.trim()) problem = 'Enter the vaccine or disease.';
    else if (vaccination === 'vaccinated' && !proof) problem = 'Attach vaccination proof.';
    else if (!streetPurok.trim()) problem = 'Enter the street or purok.';
    else if (!barangay.trim()) problem = 'Enter the barangay.';
    else if (locationIssue(pickupLocation, [DAVAO_DEL_NORTE])) problem = locationIssue(pickupLocation, [DAVAO_DEL_NORTE])!;
    else if (pickupLocation?.address?.city && listingLocality(pickupLocation.address.city) !== city) problem = 'Confirm a pickup pin in the selected municipality or city.';
    else if (!Number.isFinite(Number(price)) || Number(price) <= 0) problem = 'Enter a valid listing price.';
    if (problem || !pickupPin) {
      const message = problem || 'Choose and confirm the livestock pickup point on the map.';
      setError(message);
      showMessage('Complete your listing', message);
      return;
    }

    publishingRef.current = true; setPublishing(true); setError('');
    try {
    const listing = await marketplace.publishListing(listingInput(), pickupPin, initialDraft?.id, operationId);
    onPublished(listing.id);
    } catch (issue) {
      const message = issue instanceof Error ? issue.message : 'Unable to publish your listing. Please try again.';
      setError(message); showMessage('Listing not published', message);
    } finally { publishingRef.current = false; setPublishing(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 5 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close create listing" hitSlop={8} onPress={onClose} style={styles.closeButton}>
          <NavigationIcon name="close" />
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>Create Listing</Text>
        <View style={styles.closeButton} />
      </View>

      <KeyboardScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={styles.field}>
          <Label required>Photos</Label>
          <View style={styles.photoRow}>
            {photos.length < 4 && (
              <Pressable accessibilityRole="button" accessibilityLabel="Add livestock photos" onPress={addPhotos} style={styles.addPhoto}>
                <Icon name={icons.camera} size={23} />
                <Text style={styles.addPhotoText}>Add</Text>
              </Pressable>
            )}
            {photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.photoThumb}>
                <Image source={{ uri }} contentFit="cover" style={styles.photoImage} />
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} hitSlop={10} onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} style={styles.removePhoto}>
                  <NavigationIcon name="close" size={16} color="#fff" />
                </Pressable>
              </View>
            ))}
            {!photos.length && <View style={styles.photoPlaceholder}><Icon name={icons.photo} size={27} /></View>}
          </View>
        </View>

        <Field label="Listing Title" required value={title} onChangeText={setTitle} placeholder="e.g. Brahman Bull (Pure Breed)" />
        <SelectField label="Category" value={category} options={categories} onSelect={(value) => setCategory(value as LivestockCategory)} />
        <View style={[styles.row, stackedFields && styles.stackedRow]}>
          <View style={[styles.rowItem, stackedFields && styles.stackedItem]}><Field label="Age / Stage" value={age} onChangeText={setAge} placeholder="e.g. 2 Yrs" /></View>
          <View style={[styles.rowItem, stackedFields && styles.stackedItem]}><Field label="Weight (kg)" required value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="e.g. 450" /></View>
        </View>

        <View style={styles.vaccinationCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.cardTitle}>Vaccination Information</Text>
            <Text style={styles.requiredBadge}>Required</Text>
          </View>
          <Text style={styles.intro}>Declare the status of this livestock. Proof is required only when it is listed as vaccinated.</Text>
          <View style={styles.statusRow}>
            {([
              ['vaccinated', 'Vaccinated'], ['not-vaccinated', 'Not vaccinated'], ['unknown', 'Unknown'],
            ] as const).map(([value, label]) => (
              <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: vaccination === value }} onPress={() => { setVaccination(value); if (value !== 'vaccinated') setProof(null); }} style={[styles.statusButton, vaccination === value && styles.statusSelected]}>
                <Text style={[styles.statusText, vaccination === value && styles.statusTextSelected]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {vaccination === 'vaccinated' && (
            <>
              <View style={[styles.row, styles.stackedRow]}>
                <View style={[styles.rowItem, styles.stackedItem]}>
                  <View style={styles.field}>
                    <Label required>Vaccination Date</Label>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Vaccination Date, ${vaccinationDate || 'choose date'}`} onPress={() => { Keyboard.dismiss(); setCalendarOpen(true); }} style={[styles.input, styles.dateInput]}>
                      <Text style={styles.inputText}>{vaccinationDate || 'Select date'}</Text>
                      <Icon name={icons.calendar} size={20} />
                    </Pressable>
                  </View>
                </View>
                <View style={[styles.rowItem, styles.stackedItem]}><Field label="Vaccine / Disease" required value={vaccineName} onChangeText={setVaccineName} placeholder="e.g. FMD Vaccine" /></View>
              </View>
              <View style={styles.field}>
                <Label required>Vaccination Proof</Label>
                <Pressable accessibilityRole="button" accessibilityLabel="Upload vaccination proof" onPress={addProof} style={styles.proofUpload}>
                  <Text style={styles.proofUploadText}>Upload proof — PDF, JPG or PNG</Text>
                </Pressable>
                {proof && <View style={styles.proofAttached}><Text style={styles.proofName}>{proof.name}</Text><Text style={styles.attachedBadge}>Attached</Text></View>}
              </View>
            </>
          )}
          <Text style={styles.proofNote}>Proof applies only to this listing. It is shown as seller-provided unless reviewed by an authorized party.</Text>
        </View>

        <SelectField label="Municipality / City" value={city} options={DAVAO_DEL_NORTE_LOCALITIES.map((name) => ({ label: davaoDelNorteLocalityLabel(name), value: name }))} onSelect={(value) => { if (value !== city) setPickupLocation(null); setCity(value as DavaoDelNorteLocality); }} />
        <View style={styles.field}>
          <Label>Province</Label>
          <View style={[styles.input, styles.fixedField]}>
            <Text style={styles.inputText}>{DAVAO_DEL_NORTE}</Text>
          </View>
        </View>
        <Text style={styles.locationHelp}>Select the Davao del Norte city or municipality where the livestock is located.</Text>

        <Field label="Street / Purok" required value={streetPurok} onChangeText={setStreetPurok} placeholder="House no., street, purok" />
        <Field label="Barangay" required value={barangay} onChangeText={setBarangay} placeholder="Barangay" />
        <Text style={styles.publicAddress}>Shown on listings: {[streetPurok.trim(), barangay.trim(), davaoDelNorteLocation(city)].filter(Boolean).join(', ')}</Text>

        <View style={styles.pinCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.cardTitle}>Pin livestock location</Text>
            <Text style={styles.privateBadge}>After order only</Text>
          </View>
          <Text style={styles.mapHelp}>Confirm the livestock entrance or pickup point. Exact coordinates are shared with the order, while the address above appears on the listing.</Text>
          <LocationPicker label="Livestock pickup point" value={pickupLocation} onSelect={selectPickup} allowedProvinces={[DAVAO_DEL_NORTE]} addressQuery={[streetPurok, barangay, city, DAVAO_DEL_NORTE].filter(Boolean).join(', ')} />
        </View>

        <View style={styles.priceCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.cardTitle}>Davao del Norte Price Guide</Text>
            <Text style={styles.marketBadge}>Market reference</Text>
          </View>
          <Text style={styles.referenceLocation}>{reference.market ? `${categories.find((item) => item.value === category)?.label} ${reference.market.sample ? 'sample' : 'reference'} from ${reference.market.location}` : 'No Davao del Norte market reference available'}</Text>
          <View style={[styles.referenceRow, stackedFields && styles.stackedRow]}>
            <View style={[styles.referenceStat, stackedFields && styles.stackedItem]}><Text style={styles.statLabel}>REFERENCE RATE</Text><Text style={styles.statValue}>{reference.rate ? `${peso(reference.rate.min)}–${peso(reference.rate.max)}${reference.perKg ? '/kg' : '/head'}` : 'Unavailable'}</Text></View>
            <View style={[styles.referenceStat, stackedFields && styles.stackedItem]}><Text style={styles.statLabel}>ESTIMATED VALUE</Text><Text style={styles.statValue}>{reference.suggested !== null && reference.rate ? `${peso(reference.kg * reference.rate.min)}–${peso(reference.kg * reference.rate.max)}` : reference.perKg ? 'Enter live weight' : 'Set manually'}</Text></View>
          </View>
          <View style={[styles.priceActions, stackedFields && styles.stackedRow]}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: reference.suggested === null }} disabled={reference.suggested === null} onPress={() => { setPrice(String(reference.suggested)); setPriceUnit('per head'); }} style={[styles.suggestionButton, stackedFields && styles.stackedItem, reference.suggested === null && styles.suggestionDisabled]}>
              <Text style={styles.suggestionText}>{reference.suggested === null ? 'No suggestion' : `Use ${peso(reference.suggested)}`}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onMarketReference} style={[styles.marketButton, stackedFields && styles.stackedItem]}><Text style={styles.marketButtonText}>View market prices</Text></Pressable>
          </View>
          <Text style={styles.basis}>{reference.suggested !== null ? `Based on ${reference.kg.toLocaleString()} kg live weight and local ${reference.market?.sample ? 'sample' : 'market'} prices.` : 'Enter a live weight for a price estimate where per-kg data is available.'}</Text>
          <Text style={styles.disclaimer}>Advisory estimate. Breed, age, health, transport, and local demand may affect the final price.</Text>
        </View>

        <View style={styles.field}>
          <Field label="Listing Price (₱)" required value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Enter your selling price" />
          <Text style={styles.fieldHelp}>You control the final price. Use the suggestion or enter your own amount.</Text>
        </View>
        <View style={styles.field}>
          <Label>Description</Label>
          <TextInput
            accessibilityLabel="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Describe breed, diet, health, and temperament..."
            placeholderTextColor="#52645a"
            multiline
            textAlignVertical="top"
            scrollEnabled
            onContentSizeChange={({ nativeEvent }) => setDescriptionHeight(Math.min(180, Math.max(120, Math.ceil(nativeEvent.contentSize.height))))}
            style={[styles.input, styles.textArea, { height: descriptionHeight }]}
          />
        </View>
      </KeyboardScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Publish listing" accessibilityState={{ disabled: publishing }} disabled={publishing} onPress={publish} style={[styles.publishButton, publishing && { opacity: 0.6 }]}>
          <Text style={styles.publishText}>{publishing ? 'Publishing…' : 'Publish Listing'}</Text>
        </Pressable>
      </View>
      {calendarOpen && <CalendarPicker title="Vaccination Date" value={vaccinationDate} onSelect={setVaccinationDate} onClose={() => setCalendarOpen(false)} maxDate={calendarDateKey(new Date())} helper="Choose the date the vaccination was given. Future dates are unavailable." />}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { minHeight: 63, paddingHorizontal: 14, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#edf2f7', backgroundColor: '#fff' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...appTypography.title, flex: 1, minWidth: 0, textAlign: 'center', color: colors.forest },
  content: { padding: 20, paddingBottom: 28, gap: 17 },
  field: { ...appFormStyles.field },
  label: { ...appFormStyles.label, color: colors.ink },
  required: { color: colors.red },
  input: { ...appFormStyles.control, ...appFormStyles.value, width: '100%', borderColor: colors.line, backgroundColor: colors.input, color: '#2d3748' },
  inputText: { ...appFormStyles.value, flexShrink: 1, minWidth: 0, color: '#2d3748' },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  fixedField: { justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 12 },
  rowItem: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0 },
  stackedRow: { flexDirection: 'column', flexWrap: 'nowrap' },
  stackedItem: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  textArea: { minHeight: 120, paddingTop: 12, color: colors.ink },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  addPhoto: { width: 72, height: 72, borderRadius: 11, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#bccfc2', backgroundColor: '#f7faf7', alignItems: 'center', justifyContent: 'center' },
  addPhotoText: { color: '#4a5568', fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 3 },
  photoPlaceholder: { width: 72, height: 72, borderRadius: 11, borderWidth: 1, borderColor: '#c7e5c4', backgroundColor: '#e2efe0', alignItems: 'center', justifyContent: 'center' },
  photoThumb: { width: 72, height: 72, borderRadius: 11, borderWidth: 1, borderColor: '#c7e5c4', backgroundColor: '#e2efe0' },
  photoImage: { ...StyleSheet.absoluteFill, borderRadius: 10 },
  removePhoto: { position: 'absolute', right: -8, top: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: '#e53e3e', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  vaccinationCard: { padding: 14, gap: 11, borderWidth: 1, borderColor: '#c7e5c4', borderRadius: 14, backgroundColor: '#fbfdfb' },
  sectionHead: { flexDirection: 'column', alignItems: 'flex-start', gap: 6 },
  cardTitle: { color: colors.forest, fontSize: 15, lineHeight: 21, fontWeight: '800', flexShrink: 1 },
  requiredBadge: { color: colors.red, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  intro: { color: '#52645a', fontSize: 14, lineHeight: 21 },
  statusRow: { gap: 8 },
  statusButton: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#d8e2dc', borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  statusSelected: { backgroundColor: colors.forest },
  statusText: { color: '#4a5568', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  statusTextSelected: { color: '#fff' },
  dateInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  proofUpload: { minHeight: 48, padding: 11, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9fc7ad', borderRadius: 11, backgroundColor: '#f4faf6', alignItems: 'center', justifyContent: 'center' },
  proofUploadText: { color: colors.forest, fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  proofAttached: { minHeight: 44, marginTop: 3, paddingHorizontal: 9, paddingVertical: 8, borderWidth: 1, borderColor: '#dfe8e2', borderRadius: 9, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, backgroundColor: '#fff' },
  proofName: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0, color: '#2d3748', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  attachedBadge: { color: '#166534', fontSize: 13, lineHeight: 18, fontWeight: '700', backgroundColor: '#dff2e5', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4 },
  proofNote: { color: '#52647a', fontSize: 13, lineHeight: 19 },
  locationHelp: { color: '#52647a', fontSize: 13, lineHeight: 19 },
  publicAddress: { color: '#52647a', fontSize: 13, lineHeight: 19 },
  pinCard: { padding: 14, gap: 11, borderWidth: 1, borderColor: '#c7e5c4', borderRadius: 14, backgroundColor: '#fbfdfb' },
  privateBadge: { color: '#276749', backgroundColor: '#e4f3e8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  mapHelp: { color: '#52647a', fontSize: 13, lineHeight: 19 },
  priceCard: { padding: 15, gap: 10, borderRadius: 14, backgroundColor: '#eaf5ed' },
  marketBadge: { flexShrink: 1, maxWidth: '100%', color: '#1b4d3e', backgroundColor: '#d6eadc', fontSize: 13, lineHeight: 18, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  referenceLocation: { color: '#4a5568', fontSize: 13, lineHeight: 18 },
  referenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  referenceStat: { flexGrow: 1, flexShrink: 1, flexBasis: 110, minWidth: 0, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.8)' },
  statLabel: { color: '#52645a', fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.3 },
  statValue: { color: colors.forest, fontSize: 14, lineHeight: 19, fontWeight: '800', marginTop: 3 },
  priceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionButton: { flexGrow: 1, flexShrink: 1, flexBasis: 130, minHeight: 48, borderRadius: 9, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 10 },
  suggestionDisabled: { backgroundColor: '#9aaba2' },
  suggestionText: { color: '#fff', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  marketButton: { flexGrow: 1, flexShrink: 1, flexBasis: 130, minHeight: 48, borderRadius: 9, borderWidth: 1, borderColor: colors.forest, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 10 },
  marketButtonText: { color: colors.forest, fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  basis: { color: '#2f6b50', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  disclaimer: { color: '#5f6f66', fontSize: 13, lineHeight: 18 },
  fieldHelp: { color: '#52645a', fontSize: 13, lineHeight: 18 },
  error: { color: '#9b1c1c', backgroundColor: '#fff1f0', padding: 10, borderRadius: 9, fontSize: 13, lineHeight: 18 },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#edf2f7' },
  publishButton: { minHeight: 50, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 11, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  publishText: { color: '#fff', fontSize: 15, lineHeight: 21, fontWeight: '700', textAlign: 'center', includeFontPadding: false },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,28,20,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  optionSheet: { width: '100%', maxWidth: 360, maxHeight: '85%', padding: 12, borderRadius: 16, backgroundColor: '#fff' },
  optionList: { maxHeight: 430, flexShrink: 1 },
  optionTitle: { color: colors.forest, fontSize: 16, lineHeight: 22, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 10 },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#edf2f7' },
  optionText: { color: colors.ink, fontSize: 14, lineHeight: 19 },
  optionSelected: { color: colors.forest, fontWeight: '800' },
});
