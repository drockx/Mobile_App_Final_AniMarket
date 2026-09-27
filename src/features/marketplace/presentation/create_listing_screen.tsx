import { useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import {
  Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DAVAO_DEL_NORTE, DAVAO_DEL_NORTE_LOCALITIES, davaoDelNorteLocalityLabel, davaoDelNorteLocation,
  type DavaoDelNorteLocality,
} from '@/constants/davao_del_norte';
import { marketReferenceData } from '@/features/market_reference/market_reference_dependencies';

import type { MarketplaceService } from '../application/marketplace_service';
import type { LivestockCategory, PickupPin } from '../domain/listing';
import { PickupLocationMap } from './pickup_location_map';

const colors = {
  forest: '#12372a', ink: '#1a202c', muted: '#64748b', line: '#e2e8f0',
  input: '#f8fafc', mint: '#e8f4eb', red: '#c53030',
};
const categories: { label: string; value: LivestockCategory }[] = [
  { label: 'Cattle', value: 'Cow' }, { label: 'Goats', value: 'Goat' },
  { label: 'Swine', value: 'Pig' }, { label: 'Poultry', value: 'Chicken' },
];
type VaccinationStatus = 'vaccinated' | 'not-vaccinated' | 'unknown';
type IconName = React.ComponentProps<typeof SymbolView>['name'];
const icons = {
  close: { ios: 'xmark', android: 'close', web: 'close' },
  camera: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  photo: { ios: 'photo', android: 'image', web: 'image' },
  chevron: { ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  locate: { ios: 'location', android: 'my_location', web: 'my_location' },
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
        placeholderTextColor="#8290a4"
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
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${selected}`} onPress={() => setOpen(true)} style={[styles.input, styles.select]}>
        <Text numberOfLines={1} style={styles.inputText}>{selected}</Text>
        <Icon name={icons.chevron} size={16} color="#718096" />
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getTime() <= Date.now();
}

export function CreateListingScreen({ marketplace, onClose, onPublished, onMarketReference }: {
  marketplace: MarketplaceService;
  onClose: () => void;
  onPublished: (id: string) => void;
  onMarketReference: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LivestockCategory>('Cow');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [vaccination, setVaccination] = useState<VaccinationStatus>('vaccinated');
  const [vaccinationDate, setVaccinationDate] = useState('');
  const [vaccineName, setVaccineName] = useState('');
  const [proof, setProof] = useState<{ name: string; uri: string } | null>(null);
  const [city, setCity] = useState<DavaoDelNorteLocality>('Tagum City');
  const [streetPurok, setStreetPurok] = useState('');
  const [barangay, setBarangay] = useState('');
  const [pickupPin, setPickupPin] = useState<PickupPin | null>(null);
  const [mapCenter, setMapCenter] = useState<PickupPin | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const reference = useMemo(() => {
    const market = marketReferenceData.find((item) => item.location === davaoDelNorteLocation(city))
      ?? marketReferenceData[0];
    const marketCategory = { Cow: 'cow', Goat: 'goat', Pig: 'pig', Chicken: 'poultry' }[category];
    const rate = market?.prices.find((item) => item.category === marketCategory);
    const kg = Number(weight);
    const perKg = rate?.unit.toLowerCase().includes('per kg') ?? false;
    const suggested = rate && perKg && Number.isFinite(kg) && kg > 0
      ? Math.max(100, Math.round((kg * (rate.min + rate.max) / 2) / 500) * 500) : null;
    return { market, rate, perKg, kg, suggested };
  }, [category, city, weight]);

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

  async function useCurrentLocation() {
    if (locating) return;
    setLocating(true);
    setLocationMessage('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationMessage('Location permission was denied. Tap the map to set the pickup pin.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextPin = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setPickupPin(nextPin);
      setMapCenter(nextPin);
      setLocationMessage('Current location set. Tap the map or drag the pin if the livestock is elsewhere.');
    } catch {
      setLocationMessage('Could not get your location. Tap the map to set the pickup pin.');
    } finally {
      setLocating(false);
    }
  }

  function publish() {
    let problem = '';
    if (!photos.length) problem = 'Add at least one livestock photo.';
    else if (!title.trim()) problem = 'Enter a listing title.';
    else if (!Number.isFinite(Number(weight)) || Number(weight) <= 0) problem = 'Enter a valid weight in kilograms.';
    else if (vaccination === 'vaccinated' && !validDate(vaccinationDate)) problem = 'Enter a valid vaccination date in YYYY-MM-DD format.';
    else if (vaccination === 'vaccinated' && !vaccineName.trim()) problem = 'Enter the vaccine or disease.';
    else if (vaccination === 'vaccinated' && !proof) problem = 'Attach vaccination proof.';
    else if (!streetPurok.trim()) problem = 'Enter the street or purok.';
    else if (!barangay.trim()) problem = 'Enter the barangay.';
    else if (!pickupPin) problem = 'Tap the map or use your current location to set a pickup pin.';
    else if (!Number.isFinite(Number(price)) || Number(price) <= 0) problem = 'Enter a valid listing price.';
    if (problem || !pickupPin) {
      const message = problem || 'Tap the map or use your current location to set a pickup pin.';
      setError(message);
      showMessage('Complete your listing', message);
      return;
    }

    const listing = marketplace.publishListing({
      title: title.trim(), category, details: `${age.trim() || 'Age not specified'} · ${weight.trim()} kg`,
      price: Number(price), verified: false, location: davaoDelNorteLocation(city),
      streetPurok: streetPurok.trim(), barangay: barangay.trim(),
      weight: `${weight.trim()} kg`, age: age.trim() || 'Not specified',
      health: vaccination === 'vaccinated' ? 'Vaccinated' : vaccination === 'not-vaccinated' ? 'Not vaccinated' : 'Unknown',
      healthVerification: { status: 'unverified' },
      description: description.trim() || 'No description provided.',
      imageUri: photos[0], imageUris: photos, vaccinationProof: proof ?? undefined,
      seller: { name: 'Juan Dela Cruz', memberSince: '2026' },
    }, pickupPin);
    onPublished(listing.id);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 5 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close create listing" hitSlop={8} onPress={onClose} style={styles.closeButton}>
          <Icon name={icons.close} size={21} />
        </Pressable>
        <Text style={styles.headerTitle}>Create Listing</Text>
        <View style={styles.closeButton} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
                <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} style={styles.removePhoto}>
                  <Icon name={icons.close} size={11} color="#fff" />
                </Pressable>
              </View>
            ))}
            {!photos.length && <View style={styles.photoPlaceholder}><Icon name={icons.photo} size={27} /></View>}
          </View>
        </View>

        <Field label="Listing Title" required value={title} onChangeText={setTitle} placeholder="e.g. Brahman Bull (Pure Breed)" />
        <SelectField label="Category" value={category} options={categories} onSelect={(value) => setCategory(value as LivestockCategory)} />
        <View style={styles.row}>
          <View style={styles.rowItem}><Field label="Age / Stage" value={age} onChangeText={setAge} placeholder="e.g. 2 Yrs" /></View>
          <View style={styles.rowItem}><Field label="Weight (kg)" required value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="e.g. 450" /></View>
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
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <View style={styles.field}>
                    <Label required>Vaccination Date</Label>
                    <View style={[styles.input, styles.dateInput]}>
                      <TextInput accessibilityLabel="Vaccination Date" value={vaccinationDate} onChangeText={setVaccinationDate} placeholder="YYYY-MM-DD" placeholderTextColor="#8290a4" keyboardType="numbers-and-punctuation" maxLength={10} style={styles.dateText} />
                      <Icon name={icons.calendar} size={15} color="#718096" />
                    </View>
                  </View>
                </View>
                <View style={styles.rowItem}><Field label="Vaccine / Disease" required value={vaccineName} onChangeText={setVaccineName} placeholder="e.g. FMD Vaccine" /></View>
              </View>
              <View style={styles.field}>
                <Label required>Vaccination Proof</Label>
                <Pressable accessibilityRole="button" accessibilityLabel="Upload vaccination proof" onPress={addProof} style={styles.proofUpload}>
                  <Text style={styles.proofUploadText}>Upload proof — PDF, JPG or PNG</Text>
                </Pressable>
                {proof && <View style={styles.proofAttached}><Text numberOfLines={1} style={styles.proofName}>{proof.name}</Text><Text style={styles.attachedBadge}>Attached</Text></View>}
              </View>
            </>
          )}
          <Text style={styles.proofNote}>Proof applies only to this listing. It is shown as seller-provided unless reviewed by an authorized party.</Text>
        </View>

        <SelectField label="Municipality / City" value={city} options={DAVAO_DEL_NORTE_LOCALITIES.map((name) => ({ label: davaoDelNorteLocalityLabel(name), value: name }))} onSelect={(value) => setCity(value as DavaoDelNorteLocality)} />
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
          <Text style={styles.mapHelp}>Tap the map to mark where the livestock is located. Drag the pin to adjust it.</Text>
          <View style={styles.mapFrame}>
            <PickupLocationMap pin={pickupPin} center={mapCenter} onPinChange={setPickupPin} />
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: locating }} disabled={locating} onPress={useCurrentLocation} style={styles.locateButton}>
            <Icon name={icons.locate} size={17} />
            <Text style={styles.locateText}>{locating ? 'Getting location…' : 'Use my current location'}</Text>
          </Pressable>
          {!!locationMessage && <Text style={styles.locationMessage}>{locationMessage}</Text>}
          <Text style={styles.pinStatus}>{pickupPin ? 'Pickup pin set' : 'No pickup pin selected yet'}</Text>
        </View>

        <View style={styles.priceCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.cardTitle}>Davao del Norte Price Guide</Text>
            <Text style={styles.marketBadge}>Market reference</Text>
          </View>
          <Text style={styles.referenceLocation}>{reference.market ? `${categories.find((item) => item.value === category)?.label} sample from ${reference.market.location}` : 'No Davao del Norte market reference available'}</Text>
          <View style={styles.referenceRow}>
            <View style={styles.referenceStat}><Text style={styles.statLabel}>REFERENCE RATE</Text><Text style={styles.statValue}>{reference.rate ? `${peso(reference.rate.min)}–${peso(reference.rate.max)}${reference.perKg ? '/kg' : '/head'}` : 'Unavailable'}</Text></View>
            <View style={styles.referenceStat}><Text style={styles.statLabel}>ESTIMATED VALUE</Text><Text style={styles.statValue}>{reference.suggested !== null && reference.rate ? `${peso(reference.kg * reference.rate.min)}–${peso(reference.kg * reference.rate.max)}` : reference.perKg ? 'Enter live weight' : 'Set manually'}</Text></View>
          </View>
          <View style={styles.priceActions}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: reference.suggested === null }} disabled={reference.suggested === null} onPress={() => setPrice(String(reference.suggested))} style={[styles.suggestionButton, reference.suggested === null && styles.suggestionDisabled]}>
              <Text style={styles.suggestionText}>{reference.suggested === null ? 'No suggestion' : `Use ${peso(reference.suggested)}`}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onMarketReference} style={styles.marketButton}><Text style={styles.marketButtonText}>View market prices</Text></Pressable>
          </View>
          <Text style={styles.basis}>{reference.suggested !== null ? `Based on ${reference.kg.toLocaleString()} kg live weight and local sample prices.` : 'Enter a live weight for a price estimate where per-kg data is available.'}</Text>
          <Text style={styles.disclaimer}>Advisory sample only. Breed, age, health, transport, and local demand may affect the final price.</Text>
        </View>

        <View style={styles.field}>
          <Field label="Listing Price (₱)" required value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="Enter your selling price" />
          <Text style={styles.fieldHelp}>You control the final price. Use the suggestion or enter your own amount.</Text>
        </View>
        <Field label="Description" value={description} onChangeText={setDescription} multiline placeholder="Describe breed, diet, health, and temperament..." />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Publish listing" onPress={publish} style={styles.publishButton}>
          <Text style={styles.publishText}>Publish Listing</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { minHeight: 63, paddingHorizontal: 14, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#edf2f7', backgroundColor: '#fff' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.forest, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 28, gap: 17 },
  field: { flex: 1, gap: 7 },
  label: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  required: { color: colors.red },
  input: { minHeight: 46, width: '100%', paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 11, backgroundColor: colors.input, color: '#2d3748', fontSize: 14, lineHeight: 20 },
  inputText: { flex: 1, color: '#2d3748', fontSize: 14, lineHeight: 20 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  fixedField: { justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowItem: { flex: 1, minWidth: 0 },
  textArea: { minHeight: 100, paddingTop: 12 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  addPhoto: { width: 72, height: 72, borderRadius: 11, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#bccfc2', backgroundColor: '#f7faf7', alignItems: 'center', justifyContent: 'center' },
  addPhotoText: { color: '#4a5568', fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 3 },
  photoPlaceholder: { width: 72, height: 72, borderRadius: 11, borderWidth: 1, borderColor: '#c7e5c4', backgroundColor: '#e2efe0', alignItems: 'center', justifyContent: 'center' },
  photoThumb: { width: 72, height: 72, borderRadius: 11, borderWidth: 1, borderColor: '#c7e5c4', backgroundColor: '#e2efe0' },
  removePhoto: { position: 'absolute', right: -8, top: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: '#e53e3e', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  vaccinationCard: { padding: 14, gap: 11, borderWidth: 1, borderColor: '#c7e5c4', borderRadius: 14, backgroundColor: '#fbfdfb' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: colors.forest, fontSize: 15, lineHeight: 20, fontWeight: '800', flexShrink: 1 },
  requiredBadge: { color: colors.red, fontSize: 11, fontWeight: '700' },
  intro: { color: '#5f6f66', fontSize: 12, lineHeight: 17 },
  statusRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#d8e2dc', borderRadius: 10, overflow: 'hidden' },
  statusButton: { flex: 1, minHeight: 44, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  statusSelected: { backgroundColor: colors.forest },
  statusText: { color: '#4a5568', fontSize: 11, lineHeight: 15, fontWeight: '700', textAlign: 'center' },
  statusTextSelected: { color: '#fff' },
  dateInput: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dateText: { flex: 1, minWidth: 0, padding: 0, color: '#2d3748', fontSize: 14 },
  proofUpload: { minHeight: 48, padding: 11, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9fc7ad', borderRadius: 11, backgroundColor: '#f4faf6', alignItems: 'center', justifyContent: 'center' },
  proofUploadText: { color: colors.forest, fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  proofAttached: { minHeight: 39, marginTop: 3, paddingHorizontal: 9, borderWidth: 1, borderColor: '#dfe8e2', borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff' },
  proofName: { flex: 1, color: '#2d3748', fontSize: 11, fontWeight: '600' },
  attachedBadge: { color: '#166534', fontSize: 10, fontWeight: '700', backgroundColor: '#dff2e5', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4 },
  proofNote: { color: '#718096', fontSize: 11, lineHeight: 15 },
  locationHelp: { marginTop: -10, color: '#8491a6', fontSize: 11, lineHeight: 15 },
  publicAddress: { marginTop: -9, color: '#64748b', fontSize: 11, lineHeight: 16 },
  pinCard: { padding: 14, gap: 11, borderWidth: 1, borderColor: '#c7e5c4', borderRadius: 14, backgroundColor: '#fbfdfb' },
  privateBadge: { color: '#276749', backgroundColor: '#e4f3e8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontSize: 10, fontWeight: '700' },
  mapHelp: { color: '#64748b', fontSize: 11, lineHeight: 16 },
  mapFrame: { borderRadius: 10, borderWidth: 1, borderColor: '#d9e9dd', overflow: 'hidden', backgroundColor: '#eaf5ed' },
  locateButton: { minHeight: 44, alignSelf: 'flex-start', paddingHorizontal: 12, borderWidth: 1, borderColor: '#b9d8c2', borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#fff' },
  locateText: { color: colors.forest, fontSize: 12, fontWeight: '700' },
  locationMessage: { color: '#64748b', fontSize: 11, lineHeight: 16 },
  pinStatus: { color: colors.forest, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  priceCard: { padding: 15, gap: 10, borderRadius: 14, backgroundColor: '#eaf5ed' },
  marketBadge: { flexShrink: 0, color: '#1b4d3e', backgroundColor: '#d6eadc', fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  referenceLocation: { color: '#4a5568', fontSize: 12, lineHeight: 17 },
  referenceRow: { flexDirection: 'row', gap: 8 },
  referenceStat: { flex: 1, minWidth: 0, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.8)' },
  statLabel: { color: '#718096', fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.3 },
  statValue: { color: colors.forest, fontSize: 14, lineHeight: 19, fontWeight: '800', marginTop: 3 },
  priceActions: { flexDirection: 'row', gap: 8 },
  suggestionButton: { flex: 1, minHeight: 44, borderRadius: 9, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  suggestionDisabled: { backgroundColor: '#9aaba2' },
  suggestionText: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  marketButton: { flex: 1, minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: colors.forest, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  marketButtonText: { color: colors.forest, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  basis: { color: '#2f6b50', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  disclaimer: { color: '#5f6f66', fontSize: 11, lineHeight: 15 },
  fieldHelp: { color: '#8491a6', fontSize: 11, lineHeight: 15 },
  error: { color: '#9b1c1c', backgroundColor: '#fff1f0', padding: 10, borderRadius: 9, fontSize: 13, lineHeight: 18 },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#edf2f7' },
  publishButton: { minHeight: 48, borderRadius: 11, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  publishText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,28,20,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  optionSheet: { width: '100%', maxWidth: 360, padding: 12, borderRadius: 16, backgroundColor: '#fff' },
  optionList: { maxHeight: 430 },
  optionTitle: { color: colors.forest, fontSize: 16, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 10 },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#edf2f7' },
  optionText: { color: colors.ink, fontSize: 14 },
  optionSelected: { color: colors.forest, fontWeight: '800' },
});
