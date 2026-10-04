const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const Module = require('node:module');
const vm = require('node:vm');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};

const { isCoordinate, locationIssue, copyLocation, sameCity } = require('../src/features/location/domain/location.ts');
const { parsePhotonResults, createPhotonGeocoder } = require('../src/features/location/data/photon_geocoder.ts');
const { createLocationService } = require('../src/features/location/application/location_service.ts');
const { isInsideDavaoDelNorte, DAVAO_DEL_NORTE_BOUNDS } = require('../src/features/location/domain/davao_del_norte_geofence.ts');
const { createMapDocument } = require('../src/features/location/presentation/map_document.ts');
const { decodeMapEvent } = require('../src/features/location/presentation/map_types.ts');
const point = { latitude: 7.4482, longitude: 125.807 };
const feature = (properties = {}, coordinates = [point.longitude, point.latitude]) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates },
  properties: { osm_type: 'N', osm_id: 1, name: 'Tagum address', street: 'Rizal Street', district: 'Magugpo Poblacion', city: 'Tagum', state: 'Davao del Norte', countrycode: 'PH', postcode: '8100', ...properties },
});
const payload = (...features) => ({ type: 'FeatureCollection', features });
const selected = () => ({ coordinate: { ...point }, source: 'current', accuracyMeters: 12, address: { label: 'Rizal Street, Tagum City', city: 'Tagum City', province: 'Davao del Norte', countryCode: 'PH' } });

function loadDevice(platform, location = {}) {
  const filename = require.resolve('../src/features/location/data/device_location.ts');
  const original = Module._load;
  delete require.cache[filename];
  Module._load = function (name, parent, isMain) {
    if (name === 'expo-location') return location;
    if (name === 'react-native') return { Platform: { OS: platform } };
    return original.call(this, name, parent, isMain);
  };
  try { return require(filename).deviceLocation; }
  finally { Module._load = original; delete require.cache[filename]; }
}

test('native GPS refines a coarse fix using highest accuracy and stops the watch', async () => {
  let options;
  let removed = 0;
  const device = loadDevice('android', {
    Accuracy: { Highest: 5 }, requestForegroundPermissionsAsync: async () => ({ granted: true }),
    hasServicesEnabledAsync: async () => true,
    watchPositionAsync: async (value, receive) => {
      options = value;
      receive({ coords: { latitude: 7.45, longitude: 125.81, accuracy: 200 }, timestamp: Date.now() });
      receive({ coords: { ...point, accuracy: 12 }, timestamp: Date.now() });
      return { remove: () => { removed++; } };
    },
  });
  assert.deepEqual(await device.current(), { coordinate: point, accuracyMeters: 12 });
  await Promise.resolve();
  assert.deepEqual(options, { accuracy: 5, distanceInterval: 0, timeInterval: 1000, mayShowUserSettingsDialog: true });
  assert.equal(removed, 1);
});

test('denied native permission and disabled device location never request GPS', async () => {
  let calls = 0;
  const location = { watchPositionAsync: async () => { calls++; }, requestForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }) };
  await assert.rejects(loadDevice('ios', location).current(), (error) => error.settingsAvailable && /denied/.test(error.message));
  await assert.rejects(loadDevice('android', { ...location, requestForegroundPermissionsAsync: async () => ({ granted: true }), hasServicesEnabledAsync: async () => false }).current(), /Turn on/);
  assert.equal(calls, 0);
});

test('a native GPS failure produces a useful message instead of an internal API error', async () => {
  const device = loadDevice('ios', { requestForegroundPermissionsAsync: async () => ({ granted: true }), hasServicesEnabledAsync: async () => true, Accuracy: { Highest: 5 }, watchPositionAsync: async () => { throw new Error('Internal native failure'); } });
  await assert.rejects(device.current(), /Check your device location settings/);
});

test('browser GPS works without a Permissions API and does not reuse an old position', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let options;
  const cleared = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    watchPosition: (receive, _, value) => { options = value; receive({ coords: { ...point, accuracy: 18 }, timestamp: Date.now() }); return 7; },
    clearWatch: (id) => cleared.push(id),
  } } });
  try {
    assert.deepEqual(await loadDevice('web').current(), { coordinate: point, accuracyMeters: 18 });
    assert.deepEqual(options, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    assert.deepEqual(cleared, [7]);
    navigator.geolocation.watchPosition = (_, reject) => { reject({ code: 1 }); return 8; };
    await assert.rejects(loadDevice('web').current(), /browser settings/);
    assert.deepEqual(cleared, [7, 8]);
  } finally { if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator; }
});

function nativeWatch(watchPositionAsync) {
  return loadDevice('ios', { Accuracy: { Highest: 5 }, requestForegroundPermissionsAsync: async () => ({ granted: true }), hasServicesEnabledAsync: async () => true, watchPositionAsync });
}

test('GPS ignores stale and invalid fixes, keeps the most accurate fix at timeout, and stops tracking', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let receive, removed = 0;
  const device = nativeWatch(async (_, callback) => { receive = callback; return { remove: () => removed++ }; });
  const request = device.current();
  await new Promise(setImmediate);
  receive({ coords: { ...point, accuracy: 1 }, timestamp: Date.now() - 60000 });
  receive({ coords: { latitude: NaN, longitude: 125, accuracy: 1 }, timestamp: Date.now() });
  receive({ coords: { latitude: 7.45, longitude: 125.81, accuracy: 120 }, timestamp: Date.now() });
  receive({ coords: { ...point, accuracy: 35 }, timestamp: Date.now() });
  receive({ coords: { latitude: 7.46, longitude: 125.82, accuracy: 80 }, timestamp: Date.now() });
  t.mock.timers.tick(20000);
  assert.deepEqual(await request, { coordinate: point, accuracyMeters: 35 });
  assert.equal(removed, 1);
});

test('GPS without a valid fix times out and missing accuracy is never treated as precise', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let receive, removed = 0;
  const device = nativeWatch(async (_, callback) => { receive = callback; return { remove: () => removed++ }; });
  const failed = device.current();
  const failure = assert.rejects(failed, /timed out/);
  await new Promise(setImmediate);
  receive({ coords: { ...point, accuracy: 1 }, timestamp: Date.now() - 60000 });
  t.mock.timers.tick(20000);
  await failure;
  const unknown = device.current();
  await new Promise(setImmediate);
  receive({ coords: { ...point, accuracy: null }, timestamp: Date.now() });
  t.mock.timers.tick(20000);
  assert.deepEqual(await unknown, { coordinate: point, accuracyMeters: undefined });
  assert.equal(removed, 2);
});

test('cancelling GPS before watch startup completes removes the late subscription', async () => {
  const controller = new AbortController();
  let attach, receive, removed = 0;
  const device = nativeWatch((_, callback) => { receive = callback; return new Promise((resolve) => { attach = resolve; }); });
  const request = device.current(controller.signal);
  const failure = assert.rejects(request, /cancelled/);
  await new Promise(setImmediate);
  controller.abort();
  attach({ remove: () => removed++ });
  receive({ coords: { ...point, accuracy: 5 }, timestamp: Date.now() });
  await failure;
  await new Promise(setImmediate);
  assert.equal(removed, 1);
});

test('browser cancellation clears the GPS watch and ignores subsequent readings', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let receive, removed = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    watchPosition: (callback) => { receive = callback; return 9; }, clearWatch: (id) => { assert.equal(id, 9); removed++; },
  } } });
  try {
    const controller = new AbortController();
    const request = loadDevice('web').current(controller.signal);
    const failure = assert.rejects(request, /cancelled/);
    await Promise.resolve();
    controller.abort();
    receive({ coords: { ...point, accuracy: 5 }, timestamp: Date.now() });
    await failure;
    assert.equal(removed, 1);
  } finally { if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator; }
});

test('province geofence includes mainland and Samal while excluding Davao City, nearby provinces and sea', () => {
  for (const coordinate of [point, { latitude: 7.3078, longitude: 125.6841 }, { latitude: 7.076, longitude: 125.708 }, { latitude: 7.6, longitude: 125.6 }]) assert.ok(isInsideDavaoDelNorte(coordinate), JSON.stringify(coordinate));
  for (const coordinate of [{ latitude: 7.0731, longitude: 125.6128 }, { latitude: 7.36, longitude: 125.8551 }, { latitude: 6.96, longitude: 125.61 }, { latitude: 14.5995, longitude: 120.9842 }]) {
    assert.equal(isInsideDavaoDelNorte(coordinate), false, JSON.stringify(coordinate));
    assert.ok(locationIssue({ coordinate, address: null, source: 'map' }));
  }
});

test('GPS outside the province and out-of-province search results are rejected without an address lookup', async () => {
  const outside = { latitude: 7.0731, longitude: 125.6128 };
  const service = createLocationService({ current: async () => ({ coordinate: outside }) }, {
    search: async () => [{ id: 'inside', ...selected() }, { id: 'outside', ...selected(), coordinate: outside }],
    reverse: async () => { throw new Error('Should not request an outside address'); },
  });
  await assert.rejects(service.current(), /outside Davao del Norte/);
  await assert.rejects(service.reverse(outside), /inside Davao del Norte/);
  assert.deepEqual((await service.search('Davao')).map((result) => result.id), ['inside']);
});

test('street maps use the bundled light renderer, real tile URL and province boundary without a Google key', () => {
  const html = createMapDocument(point, point, true);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.equal(scripts.length, 2);
  scripts.forEach((script) => { new vm.Script(script); });
  assert.match(html, /color-scheme:light/);
  assert.match(html, /https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(html, /Davao del Norte only/);
  assert.doesNotMatch(html, /maps\.googleapis|GOOGLE_MAPS_ANDROID_API_KEY|unpkg\.com/);
  const outside = createMapDocument({ latitude: 7.0731, longitude: 125.6128 }, { latitude: 7.0731, longitude: 125.6128 }, false);
  assert.match(outside, /"selected":null/);
});

function mapHarness(editable = true) {
  const emitted = [], mapEvents = {}, tileEvents = {}, windowEvents = {}, domEvents = {};
  const status = { hidden: false, textContent: 'Loading street map…' };
  const map = {
    center: { lat: point.latitude, lng: point.longitude }, zoom: 15,
    on: (name, listener) => { mapEvents[name] = listener; },
    getCenter: () => map.center, getZoom: () => map.zoom, getMinZoom: () => 9, getMaxZoom: () => 19,
    setView: (value, zoom) => { mapEvents.movestart?.(); map.center = { lat: value[0], lng: value[1] }; map.zoom = zoom; mapEvents.moveend?.(); },
    panTo: (value) => { mapEvents.movestart?.(); map.center = value; mapEvents.moveend?.(); },
    invalidateSize: () => {}, attributionControl: { setPrefix: () => {} },
  };
  const layer = { addTo: () => layer, on: (name, listener) => { tileEvents[name] = listener; }, remove: () => {} };
  const parent = { postMessage: (raw) => emitted.push(JSON.parse(raw)) };
  const window = { parent, addEventListener: (name, listener) => { windowEvents[name] = listener; } };
  const document = {
    getElementById: (id) => id === 'status' ? status : { addEventListener: (name, listener) => { domEvents[name] = listener; } },
    addEventListener: () => {},
  };
  const L = { map: () => map, latLngBounds: () => ({ pad: () => ({}) }), control: { zoom: () => layer }, tileLayer: () => layer, geoJSON: () => layer, marker: () => layer, divIcon: () => ({}) };
  const script = [...createMapDocument(point, point, editable).matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1];
  vm.runInNewContext(script, { L, window, document, setTimeout: () => 1, clearTimeout: () => {} });
  return { map, emitted, status, mapEvents, tileEvents, domEvents, windowEvents, window, parent };
}

test('map gestures select the new pin while camera updates and readonly maps never select a location', () => {
  const h = mapHarness();
  assert.equal(h.emitted[0].type, 'ready');
  h.window.AniMarketMap.focus(point, point);
  assert.equal(h.emitted.filter((event) => event.type === 'select').length, 0);
  assert.equal(h.emitted.filter((event) => event.type === 'moving' && event.active).length, 0);

  h.domEvents.pointerdown(); h.mapEvents.movestart(); h.mapEvents.dragstart();
  h.map.center = { lat: 7.45, lng: 125.81 }; h.mapEvents.moveend();
  assert.ok(h.emitted.some((event) => event.type === 'moving' && event.active));
  assert.deepEqual(h.emitted.find((event) => event.type === 'select').coordinate, { latitude: 7.45, longitude: 125.81 });

  h.mapEvents.click({ latlng: { lat: 7.46, lng: 125.82 } });
  assert.deepEqual(h.emitted.filter((event) => event.type === 'select').at(-1).coordinate, { latitude: 7.46, longitude: 125.82 });
  assert.deepEqual(h.map.center, { lat: 7.46, lng: 125.82 });
  h.map.zoom = 9;
  h.window.AniMarketMap.focus({ latitude: 7.076, longitude: 125.708 }, point);
  assert.equal(h.map.zoom, 17, 'A province-wide view zooms in so a coastal address stays under the pin');
  assert.deepEqual(h.map.center, { lat: 7.076, lng: 125.708 });
  for (const gesture of [() => h.domEvents.wheel({ deltaY: 1 }), () => h.domEvents.keydown({ key: 'ArrowUp' })]) {
    const previous = h.emitted.filter((event) => event.type === 'select').length;
    gesture(); h.mapEvents.movestart(); h.map.center = { lat: 7.47, lng: 125.83 }; h.mapEvents.moveend();
    assert.equal(h.emitted.filter((event) => event.type === 'select').length, previous + 1);
    assert.deepEqual(h.emitted.filter((event) => event.type === 'select').at(-1).coordinate, { latitude: 7.47, longitude: 125.83 });
  }
  const preview = mapHarness(false);
  preview.domEvents.pointerdown(); preview.mapEvents.movestart(); preview.mapEvents.dragstart(); preview.mapEvents.moveend();
  preview.mapEvents.click({ latlng: { lat: 7.45, lng: 125.81 } });
  assert.equal(preview.emitted.filter((event) => event.type === 'select').length, 0);
});

test('failed map tiles show a connection message, recover when a tile loads, and the web bridge can request readiness', () => {
  const h = mapHarness();
  h.tileEvents.loading(); h.tileEvents.tileerror(); h.tileEvents.load();
  assert.equal(h.status.hidden, false);
  assert.match(h.status.textContent, /could not load/);
  assert.equal(h.emitted.at(-1).type, 'error');
  h.tileEvents.tileload();
  assert.equal(h.status.hidden, true);
  assert.equal(h.emitted.at(-1).type, 'loaded');
  const count = h.emitted.length;
  h.windowEvents.message({ source: {}, data: { channel: 'animarket-map-control', type: 'ping' } });
  assert.equal(h.emitted.length, count);
  h.windowEvents.message({ source: h.parent, data: { channel: 'animarket-map-control', type: 'ping' } });
  assert.equal(h.emitted.at(-1).type, 'ready');
});

test('map messages accept coordinates and known attribution links, and reject malformed or unrelated messages', () => {
  const message = (value) => JSON.stringify({ channel: 'animarket-map', ...value });
  assert.deepEqual(decodeMapEvent(message({ type: 'select', coordinate: point })), { type: 'select', coordinate: point });
  assert.equal(decodeMapEvent(message({ type: 'moving', active: true })).active, true);
  for (const raw of ['bad json', '{}', message({ type: 'select', coordinate: { latitude: 99, longitude: 125 } }), message({ type: 'moving', active: 'true' }), message({ type: 'link', url: 'javascript:alert(1)' }), message({ type: 'link', url: 'https://untrusted.example/' })]) assert.equal(decodeMapEvent(raw), null);
  assert.ok(decodeMapEvent(message({ type: 'link', url: 'https://www.openstreetmap.org/copyright' })));
});

test('coordinates reject invalid values and a required pin cannot silently use the default centre', () => {
  assert.ok(isCoordinate(point));
  for (const value of [null, {}, { latitude: NaN, longitude: 125 }, { latitude: '7', longitude: 125 }, { latitude: 91, longitude: 125 }, { latitude: 7, longitude: Infinity }, { latitude: 7, longitude: -181 }]) assert.equal(isCoordinate(value), false);
  assert.ok(locationIssue(null));
  assert.equal(locationIssue(selected(), ['Davao del Norte']), null);
  assert.ok(locationIssue({ ...selected(), coordinate: { latitude: 1.35, longitude: 103.8 } }));
  assert.ok(locationIssue({ ...selected(), address: { label: 'Outside', province: 'Cebu', countryCode: 'PH' } }, ['Davao del Norte']));
  assert.ok(locationIssue({ ...selected(), address: { label: 'Outside', countryCode: 'US' } }));
});

test('Photon longitude/latitude order and Philippine address fields are mapped correctly', () => {
  const [result] = parsePhotonResults(payload(feature({ housenumber: '12' })));
  assert.deepEqual(result.coordinate, point);
  assert.equal(result.address.city, 'Tagum City');
  assert.equal(result.address.province, 'Davao del Norte');
  assert.equal(result.address.barangay, 'Magugpo Poblacion');
  assert.equal(result.address.street, '12 Rizal Street');
  assert.equal(result.address.postalCode, '8100');
  assert.equal(result.address.countryCode, 'PH');
  assert.match(result.address.label, /Rizal Street/);
  assert.equal(parsePhotonResults(payload(feature({ type: 'city', name: 'Tagum', city: undefined })))[0].address.city, 'Tagum City');
});

test('ambiguous municipality names do not turn another province into Davao del Norte', () => {
  const [carmen, sanIsidro, davao] = parsePhotonResults(payload(
    feature({ city: 'Carmen', state: 'Cotabato' }),
    feature({ city: 'San Isidro', state: 'Davao Oriental' }),
    feature({ city: 'Davao', state: 'Davao del Sur' }),
  ));
  assert.equal(carmen.address.province, 'Cotabato');
  assert.equal(sanIsidro.address.city, 'San Isidro');
  assert.equal(sanIsidro.address.province, 'Davao Oriental');
  assert.equal(davao.address.province, 'Davao City');
  assert.equal(davao.address.city, 'Davao City');
  assert.ok(sameCity('City of Tagum', 'Tagum City'));
  assert.equal(sameCity('Tagum City', 'Panabo City'), false);
  assert.ok(sameCity('Davao', 'Davao City'));
  assert.equal(sameCity('San Isidro', 'Sawata', 'Davao Oriental'), false);
  assert.ok(sameCity('San Isidro', 'Sawata', 'Davao del Norte'));
});

test('malformed, foreign and impossible search results are rejected without fabricating addresses', () => {
  assert.throws(() => parsePhotonResults({ error: 'Bad request' }), /invalid response/);
  assert.deepEqual(parsePhotonResults(payload(null, {}, feature({}, [190, 100]), feature({ countrycode: 'US' }))), []);
  assert.deepEqual(parsePhotonResults(payload()), []);
});

test('confirmed locations are independent copies so later edits cannot change saved pins', () => {
  const original = selected();
  const copy = copyLocation(original);
  copy.coordinate.latitude = 8;
  copy.address.city = 'Changed';
  assert.equal(original.coordinate.latitude, point.latitude);
  assert.equal(original.address.city, 'Tagum City');
  assert.equal(copy.accuracyMeters, 12);
});

test('search and reverse API calls encode text, bias the map and preserve the selected point', async () => {
  const calls = [];
  const geocoder = createPhotonGeocoder('https://geocoder.example/', async (url, options) => {
    calls.push({ url: new URL(url), options });
    return { ok: true, json: async () => payload(feature({}, [125.81, 7.45])) };
  });
  await geocoder.search('Rizal & Purok 2', point);
  const address = await geocoder.reverse(point);
  assert.equal(calls[0].url.searchParams.get('q'), 'Rizal & Purok 2');
  assert.equal(calls[0].url.searchParams.get('countrycode'), 'PH');
  assert.equal(calls[0].url.searchParams.get('bbox'), [DAVAO_DEL_NORTE_BOUNDS.west, DAVAO_DEL_NORTE_BOUNDS.south, DAVAO_DEL_NORTE_BOUNDS.east, DAVAO_DEL_NORTE_BOUNDS.north].join(','));
  assert.equal(calls[0].url.searchParams.get('lat'), String(point.latitude));
  assert.equal(calls[0].url.searchParams.get('lon'), String(point.longitude));
  assert.equal(calls[0].url.searchParams.get('zoom'), '15');
  assert.equal(calls[0].url.searchParams.get('location_bias_scale'), '0.2');
  assert.equal(calls[1].url.pathname, '/reverse');
  assert.equal(calls[1].url.searchParams.get('limit'), '1');
  assert.equal(calls[1].url.searchParams.get('radius'), '0.1');
  assert.equal(address.city, 'Tagum City');
  assert.deepEqual(point, { latitude: 7.4482, longitude: 125.807 });
});

test('HTTP failures, bad responses, lost connections and cancelled requests are handled', async () => {
  await assert.rejects(createPhotonGeocoder(undefined, async () => ({ ok: false })).search('Tagum'), /unavailable/);
  await assert.rejects(createPhotonGeocoder(undefined, async () => ({ ok: true, json: async () => ({}) })).search('Tagum'), /invalid response/);
  await assert.rejects(createPhotonGeocoder(undefined, async () => { throw new TypeError('Failed to fetch'); }).search('Tagum'), /could not connect/);
  const controller = new AbortController();
  const geocoder = createPhotonGeocoder(undefined, async (_, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))));
  const request = geocoder.search('Tagum', point, controller.signal);
  controller.abort();
  await assert.rejects(request, /aborted/);
});

test('service caches successful nearby address lookups, retries empty results and skips short searches', async () => {
  let reverseCalls = 0;
  let searchCalls = 0;
  let empty = false;
  const service = createLocationService({ current: async () => ({ coordinate: point, accuracyMeters: 12 }) }, {
    reverse: async () => { reverseCalls++; return empty ? null : selected().address; },
    search: async () => { searchCalls++; return []; },
  });
  assert.deepEqual(await service.current(), { coordinate: point, accuracyMeters: 12 });
  const address = await service.reverse(point);
  address.city = 'Changed';
  assert.equal((await service.reverse(point)).city, 'Tagum City');
  assert.equal(reverseCalls, 1);
  await service.search('  ab  ');
  assert.equal(searchCalls, 0);
  await service.search('  Tagum  ');
  assert.equal(searchCalls, 1);
  empty = true;
  await service.reverse({ ...point, latitude: 7.5 });
  await service.reverse({ ...point, latitude: 7.5 });
  assert.equal(reverseCalls, 3);
});

test('obsolete lookups do not enter the cache, and bad GPS points are rejected', async () => {
  let calls = 0;
  const controller = new AbortController();
  const service = createLocationService({ current: async () => ({ coordinate: { latitude: NaN, longitude: 125 } }) }, {
    search: async () => [], reverse: async () => { calls++; controller.abort(); return selected().address; },
  });
  await assert.rejects(service.current(), /invalid location/);
  await assert.rejects(service.reverse({ latitude: 91, longitude: 125 }), /valid point/);
  await service.reverse(point, controller.signal);
  await service.reverse(point);
  assert.equal(calls, 2);
});

if (process.argv.includes('--live')) test('live configured geocoder returns Philippine addresses and allows browser requests', async () => {
  const endpoint = process.env.EXPO_PUBLIC_GEOCODER_URL || 'https://photon.komoot.io';
  const geocoder = createPhotonGeocoder(endpoint, (url, options) => fetch(url, { ...options, headers: { ...options.headers, Origin: 'http://localhost:8081' } }).then((response) => {
    assert.ok(response.ok, `Geocoder HTTP ${response.status}`);
    const cors = response.headers.get('access-control-allow-origin');
    assert.ok(cors === '*' || cors === 'http://localhost:8081', 'Geocoder must allow the web origin');
    return response;
  }));
  const results = await geocoder.search('Tagum', point);
  assert.ok(results.some((result) => result.address.city === 'Tagum City'));
  const address = await geocoder.reverse(point);
  assert.equal(address.countryCode, 'PH');
  assert.equal(address.province, 'Davao del Norte');
});

if (process.argv.includes('--live')) test('the street-map provider serves a real PNG tile for the Tagum viewport', async () => {
  const zoom = 15, scale = 2 ** zoom, radians = point.latitude * Math.PI / 180;
  const x = Math.floor((point.longitude + 180) / 360 * scale);
  const y = Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * scale);
  const response = await fetch(`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`, {
    signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'AniMarket/1.0 (map connectivity check)' },
  });
  assert.ok(response.ok, `Map tile HTTP ${response.status}`);
  assert.match(response.headers.get('content-type'), /image\/png/);
  assert.ok(response.headers.get('cache-control'), 'Tiles must allow the renderer to honor provider caching');
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(bytes.length > 1000);
});
