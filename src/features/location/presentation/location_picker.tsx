import { NavigationIcon } from '@/components/navigation_icon';
import { useEffect, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { coordinateLabel, copyLocation, DEFAULT_MAP_CENTER, isCoordinate, locationIssue, type Coordinate, type LocationResult, type SelectedLocation } from '../domain/location';
import { LocationFailure } from '../domain/location_provider';
import { isInsideDavaoDelNorte } from '../domain/davao_del_norte_geofence';
import { locationService } from '../location_dependencies';
import { LocationMap } from './location_map';

const colors = { forest: '#12372a', text: '#17221d', muted: '#52647a', line: '#dfe8e2', mint: '#eaf5ed', danger: '#b42318' };
const icons = {
  pin: { ios: 'mappin', android: 'location_on', web: 'location_on' },
  current: { ios: 'location', android: 'my_location', web: 'my_location' },
} as const;

function Button({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, disabled && styles.disabled, pressed && styles.pressed]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}

export function LocationPicker({ label, value, onSelect, addressQuery = '', allowedProvinces, error }: {
  label: string; value: SelectedLocation | null; onSelect: (location: SelectedLocation) => void;
  addressQuery?: string; allowedProvinces?: readonly string[]; error?: string;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SelectedLocation | null>(null);
  const [center, setCenter] = useState<Coordinate>(DEFAULT_MAP_CENTER);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [busy, setBusy] = useState<'search' | 'current' | null>(null);
  const [resolving, setResolving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const action = useRef(0);
  const searchAbort = useRef<AbortController | null>(null);
  const latitude = draft?.coordinate.latitude;
  const longitude = draft?.coordinate.longitude;
  const hasAddress = !!draft?.address;

  useEffect(() => () => { action.current++; searchAbort.current?.abort(); }, []);
  useEffect(() => {
    if (!open || latitude === undefined || longitude === undefined || hasAddress) return;
    const controller = new AbortController();
    const point = { latitude, longitude };
    const timeout = setTimeout(() => {
      locationService.reverse(point, controller.signal).then((address) => {
        if (controller.signal.aborted) return;
        setResolving(false);
        setDraft((current) => current && current.coordinate.latitude === latitude && current.coordinate.longitude === longitude ? { ...current, address } : current);
        if (!address) setMessage('No street address was found here. You can confirm this pin and enter the address details yourself.');
      }).catch(() => { if (!controller.signal.aborted) setMessage('The address lookup is unavailable. You can confirm this pin and enter the address details yourself.'); })
        .finally(() => { if (!controller.signal.aborted) setResolving(false); });
    }, 600);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [open, latitude, longitude, hasAddress, lookupAttempt]);

  function close() {
    action.current++; searchAbort.current?.abort(); setBusy(null); setResolving(false); setOpen(false);
  }
  function cancelPendingAction(active: boolean) {
    if (active) { action.current++; searchAbort.current?.abort(); setBusy(null); setResults([]); }
  }
  function showPicker() {
    action.current++;
    setDraft(value ? copyLocation(value) : null); setCenter(value?.coordinate ?? DEFAULT_MAP_CENTER);
    setQuery(addressQuery); setResults([]); setMessage(''); setMapError(false); setSettings(false); setBusy(null); setResolving(!!value && !value.address); setMoving(false); setInteracting(false); setOpen(true);
  }
  function choose(point: Coordinate, source: SelectedLocation['source'], address: SelectedLocation['address'] = null, accuracyMeters?: number) {
    if (!isCoordinate(point)) return;
    if (!isInsideDavaoDelNorte(point)) { setMessage('Choose a location inside Davao del Norte.'); return; }
    action.current++; searchAbort.current?.abort(); setBusy(null); setMessage(''); setSettings(false); setResults([]);
    setResolving(!address);
    setDraft({ coordinate: { ...point }, address, source, accuracyMeters });
    if (!address) setLookupAttempt((attempt) => attempt + 1);
    if (source !== 'map') setCenter({ ...point });
    Keyboard.dismiss();
  }
  async function search() {
    if (query.trim().length < 3) { setMessage('Enter at least three characters, such as a street, barangay, or landmark.'); return; }
    Keyboard.dismiss(); searchAbort.current?.abort();
    const controller = new AbortController(); searchAbort.current = controller;
    const version = ++action.current;
    setBusy('search'); setMessage(''); setResults([]);
    try {
      const found = await locationService.search(query, draft?.coordinate ?? center, controller.signal);
      if (action.current !== version || controller.signal.aborted) return;
      setResults(found);
      if (!found.length) setMessage('No address matched in Davao del Norte. Try adding the barangay or city, or move the pin on the map.');
    } catch (failure) { if (action.current === version) setMessage(failure instanceof Error ? failure.message : 'Address search is unavailable. Move the pin or use your current location.'); }
    finally { if (action.current === version) setBusy(null); }
  }
  async function currentLocation() {
    const version = ++action.current;
    searchAbort.current?.abort(); setBusy('current'); setMessage(''); setSettings(false);
    try {
      const position = await locationService.current();
      if (action.current === version) choose(position.coordinate, 'current', null, position.accuracyMeters);
    } catch (failure) {
      if (action.current !== version) return;
      setMessage(failure instanceof Error ? failure.message : 'Your current location is unavailable. Search your address or move the pin.');
      setSettings(failure instanceof LocationFailure && failure.settingsAvailable);
    } finally { if (action.current === version) setBusy(null); }
  }
  const issue = locationIssue(draft, allowedProvinces);
  const confirmDisabled = !draft || !!issue || !!busy || resolving || moving || interacting;
  function confirm() {
    if (!draft || confirmDisabled) return;
    onSelect(copyLocation(draft)); close();
  }

  return <View style={styles.field}>
    <Text style={styles.label}>{label} <Text style={styles.error}>*</Text></Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${value ? 'Change' : 'Choose'} ${label}`} onPress={showPicker} style={({ pressed }) => [styles.trigger, error && styles.invalid, pressed && styles.pressed]}>
      <View style={styles.triggerIcon}><SymbolView name={icons.pin} size={24} tintColor={colors.forest} /></View>
      <View style={styles.triggerCopy}><Text style={styles.triggerTitle}>{value ? 'Location confirmed' : 'Choose on map'}</Text><Text style={styles.body}>{value?.address?.label || (value ? coordinateLabel(value.coordinate) : 'Use current location or search your address')}</Text></View>
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {open && <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackground}>
        <View style={styles.screen}>
          <View style={[styles.header, { paddingTop: insets.top }]}><Pressable accessibilityRole="button" accessibilityLabel="Cancel location selection" onPress={close} style={styles.back}><NavigationIcon name="back" /></Pressable><Text accessibilityRole="header" style={styles.title}>{label}</Text><View style={styles.back} /></View>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} scrollEnabled={!moving && !interacting}>
            <Text style={styles.body}>Choose a location in Davao del Norte. Search your address, use your current location, or move the map to your entrance or pickup point.</Text>
            <TextInput accessibilityLabel="Search street, barangay, city, or landmark" value={query} onChangeText={(text) => { action.current++; searchAbort.current?.abort(); setBusy(null); setQuery(text); setResults([]); setMessage(''); }} placeholder="Street, barangay, city, or landmark" placeholderTextColor={colors.muted} returnKeyType="search" onSubmitEditing={search} autoCorrect={false} style={styles.input} />
            <Button label={busy === 'search' ? 'Searching…' : 'Search Address'} disabled={!!busy} secondary onPress={search} />
            {results.map((result) => <Pressable key={result.id} accessibilityRole="button" accessibilityLabel={`Choose ${result.address.label}`} onPress={() => choose(result.coordinate, 'search', result.address)} style={({ pressed }) => [styles.result, pressed && styles.pressed]}><SymbolView name={icons.pin} size={20} tintColor={colors.forest} /><Text style={styles.resultText}>{result.address.label}</Text></Pressable>)}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!busy }} disabled={!!busy} onPress={currentLocation} style={styles.current}><SymbolView name={icons.current} size={20} tintColor={colors.forest} /><Text style={styles.currentText}>{busy === 'current' ? 'Getting your location…' : 'Use my current location'}</Text>{busy === 'current' && <ActivityIndicator color={colors.forest} />}</Pressable>
            <View style={styles.map}><LocationMap key={mapAttempt} height={Math.min(380, Math.max(240, height * 0.38))} center={center} selected={draft?.coordinate ?? null} onChange={(point) => choose(point, 'map')} onMovingChange={(active) => { setMoving(active); cancelPendingAction(active); }} onInteractionChange={(active) => { setInteracting(active); cancelPendingAction(active); }} onLoaded={() => setMapError(false)} onOutside={() => setMessage('Choose a location inside Davao del Norte. The map returned to your last valid point.')} onError={() => setMapError(true)} /></View>
            {mapError && <View style={styles.notice}><Text style={styles.body}>The map could not load. Check your connection and retry. Search and current location are still available.</Text><Button secondary label="Retry Map" onPress={() => { setCenter(draft?.coordinate ?? center); setMoving(false); setInteracting(false); setMapError(false); setMapAttempt((attempt) => attempt + 1); }} /></View>}
            <View style={styles.selected}><Text style={styles.label}>{draft ? 'Selected location' : 'Choose a location'}</Text>{resolving && <View style={styles.loading}><ActivityIndicator color={colors.forest} /><Text style={styles.body}>Finding the nearby address…</Text></View>}<Text style={styles.selectedAddress}>{draft?.address?.label || (draft ? coordinateLabel(draft.coordinate) : 'Move the map, search an address, or use your current location.')}</Text>{draft && <Text style={styles.body}>The address is approximate. Check the pin and add your house, purok, or landmark in the form.</Text>}{draft?.accuracyMeters !== undefined && draft.accuracyMeters > 75 && <Text style={styles.warning}>GPS accuracy is about {Math.round(draft.accuracyMeters)} metres. Adjust the pin before confirming.</Text>}{draft && issue && <Text accessibilityRole="alert" style={styles.error}>{issue}</Text>}</View>
            {!!message && <View style={styles.notice}><Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>{settings && <Button secondary label="Open Location Settings" onPress={() => { Linking.openSettings().catch(() => setMessage('Open your device settings and allow location for AniMarket.')); }} />}{draft && !draft.address && !resolving && <Button secondary label="Retry Address Lookup" onPress={() => { setResolving(true); setLookupAttempt((attempt) => attempt + 1); }} />}</View>}
            <Text style={styles.attribution}>Address search © OpenStreetMap contributors · Photon</Text>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}><Button label="Confirm Location" onPress={confirm} disabled={confirmDisabled} /></View>
        </View>
      </KeyboardAvoidingView>
    </Modal>}
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: 8, marginVertical: 12 },
  label: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  trigger: { minHeight: 76, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#f8fbf9' },
  invalid: { borderColor: colors.danger },
  triggerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  triggerCopy: { flex: 1, minWidth: 0, gap: 4 },
  triggerTitle: { color: colors.forest, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  modalBackground: { flex: 1, backgroundColor: '#eef3ef' },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#fff' },
  header: { paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 44, minHeight: 58, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { flex: 1, minWidth: 0, paddingVertical: 12, color: colors.forest, fontSize: 22, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  content: { padding: 16, gap: 12 },
  input: { minHeight: 50, paddingVertical: 12, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 12, color: colors.text, backgroundColor: '#f8fbf9', fontSize: 14, lineHeight: 20 },
  button: { minHeight: 50, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.forest, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, lineHeight: 21, fontWeight: '800', textAlign: 'center' },
  secondary: { backgroundColor: '#fff' },
  secondaryText: { color: colors.forest },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  result: { minHeight: 56, padding: 12, gap: 10, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  resultText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, color: colors.text },
  current: { minHeight: 50, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.mint, borderRadius: 12 },
  currentText: { flex: 1, minWidth: 0, color: colors.forest, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  map: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.mint },
  selected: { gap: 8, padding: 14, borderRadius: 12, backgroundColor: '#f3faf5', borderWidth: 1, borderColor: colors.line },
  selectedAddress: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notice: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#fff8e7', borderWidth: 1, borderColor: '#f2dfae' },
  warning: { color: '#684500', fontSize: 13, lineHeight: 19 },
  attribution: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: '#fff' },
});
