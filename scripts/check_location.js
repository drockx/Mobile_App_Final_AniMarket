const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const Module = require('node:module');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};

const { isCoordinate, locationIssue, copyLocation, sameCity } = require('../src/features/location/domain/location.ts');
const { parsePhotonResults, createPhotonGeocoder } = require('../src/features/location/data/photon_geocoder.ts');
const { createLocationService } = require('../src/features/location/application/location_service.ts');
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

test('native GPS requests foreground permission and a fresh high-accuracy position', async () => {
  let options;
  const device = loadDevice('android', {
    Accuracy: { High: 4 }, requestForegroundPermissionsAsync: async () => ({ granted: true }),
    hasServicesEnabledAsync: async () => true,
    getCurrentPositionAsync: async (value) => { options = value; return { coords: { ...point, accuracy: 12 } }; },
  });
  assert.deepEqual(await device.current(), { coordinate: point, accuracyMeters: 12 });
  assert.deepEqual(options, { accuracy: 4, mayShowUserSettingsDialog: true });
});

test('denied native permission and disabled device location never request GPS', async () => {
  let calls = 0;
  const location = { getCurrentPositionAsync: async () => { calls++; }, requestForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }) };
  await assert.rejects(loadDevice('ios', location).current(), (error) => error.settingsAvailable && /denied/.test(error.message));
  await assert.rejects(loadDevice('android', { ...location, requestForegroundPermissionsAsync: async () => ({ granted: true }), hasServicesEnabledAsync: async () => false }).current(), /Turn on/);
  assert.equal(calls, 0);
});

test('a native GPS failure produces a useful message instead of an internal API error', async () => {
  const device = loadDevice('ios', { requestForegroundPermissionsAsync: async () => ({ granted: true }), hasServicesEnabledAsync: async () => true, Accuracy: { High: 4 }, getCurrentPositionAsync: async () => { throw new Error('Internal native failure'); } });
  await assert.rejects(device.current(), /Check your device location settings/);
});

test('browser GPS works without a Permissions API and does not reuse an old position', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let options;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: { getCurrentPosition: (resolve, _, value) => { options = value; resolve({ coords: { ...point, accuracy: 18 } }); } } } });
  try {
    assert.deepEqual(await loadDevice('web').current(), { coordinate: point, accuracyMeters: 18 });
    assert.deepEqual(options, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    navigator.geolocation.getCurrentPosition = (_, reject) => reject({ code: 1 });
    await assert.rejects(loadDevice('web').current(), /browser settings/);
  } finally { if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator; }
});

test('map configuration preserves existing plugins and requires a key for EAS Android builds', () => {
  const configure = require('../app.config.ts').default;
  const originalKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const originalPlatform = process.env.EAS_BUILD_PLATFORM;
  const config = { name: 'Test', slug: 'test', plugins: ['expo-router', ['expo-location', { locationWhenInUsePermission: 'Test permission' }]], web: { output: 'static' } };
  try {
    delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    delete process.env.EAS_BUILD_PLATFORM;
    assert.equal(configure({ config }).plugins.length, 3);
    process.env.EAS_BUILD_PLATFORM = 'android';
    assert.throws(() => configure({ config }), /GOOGLE_MAPS_ANDROID_API_KEY/);
    process.env.GOOGLE_MAPS_ANDROID_API_KEY = 'test_key';
    const result = configure({ config });
    assert.equal(result.plugins[2][1].androidGoogleMapsApiKey, 'test_key');
    assert.deepEqual(result.web, config.web);
    assert.deepEqual(result.plugins.slice(0, 2), config.plugins);
  } finally {
    if (originalKey === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY; else process.env.GOOGLE_MAPS_ANDROID_API_KEY = originalKey;
    if (originalPlatform === undefined) delete process.env.EAS_BUILD_PLATFORM; else process.env.EAS_BUILD_PLATFORM = originalPlatform;
  }
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
  assert.equal(calls[0].url.searchParams.get('lat'), String(point.latitude));
  assert.equal(calls[0].url.searchParams.get('lon'), String(point.longitude));
  assert.equal(calls[1].url.pathname, '/reverse');
  assert.equal(calls[1].url.searchParams.get('limit'), '1');
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
