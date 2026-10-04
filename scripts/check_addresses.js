const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  return resolve.call(this, name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2)) : name, parent, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { DAVAO_DEL_NORTE_LOCALITIES } = require('../src/constants/davao_del_norte.ts');
const { barangaysForLocality, isBarangayInLocality, canonicalBarangay } = require('../src/constants/davao_del_norte_barangays.ts');
const { validateRegistrationFields } = require('../src/features/auth/domain/validation.ts');
const { validatePersonalAddress, updatePersonalInformation, profileAddress } = require('../src/features/profile/domain/personal_information.ts');
const { emptyCheckoutForm, updateCheckoutField, selectDeliveryLocation, validateCheckout, tomorrowKey } = require('../src/features/orders/domain/checkout.ts');

test('all 223 PSA barangays are available under the correct 11 localities', () => {
  const counts = { Asuncion: 20, 'Braulio E. Dujali': 5, Carmen: 20, Kapalong: 14, 'New Corella': 20, 'Panabo City': 40, 'Island Garden City of Samal': 46, Sawata: 13, 'Santo Tomas': 19, 'Tagum City': 23, Talaingod: 3 };
  let total = 0;
  for (const city of DAVAO_DEL_NORTE_LOCALITIES) {
    const names = barangaysForLocality(city);
    assert.equal(names.length, counts[city], city);
    assert.equal(new Set(names).size, names.length, city);
    for (const name of names) assert.equal(isBarangayInLocality(city, name), true);
    total += names.length;
  }
  assert.equal(total, 223);
  assert.deepEqual(barangaysForLocality(''), []);
  assert.deepEqual(barangaysForLocality('Davao City'), []);
  assert.equal(isBarangayInLocality('Tagum City', 'Visayan Village'), true);
  assert.equal(isBarangayInLocality('Panabo City', 'Visayan Village'), false);
  assert.equal(isBarangayInLocality('Tagum City', 'Gredu'), false);
});

test('map names normalize only to unique known barangays', () => {
  assert.equal(canonicalBarangay('Tagum City', 'Brgy. Magugpo East'), 'Magugpo East');
  assert.equal(canonicalBarangay('Panabo City', 'Gredu (Pob.)'), 'Gredu');
  assert.equal(canonicalBarangay('Carmen', 'Santo Nino'), 'Sto. Niño');
  assert.equal(canonicalBarangay('New Corella', 'Santa Cruz'), 'Sta. Cruz');
  assert.equal(canonicalBarangay('Tagum City', 'Magugpo'), '');
  assert.equal(canonicalBarangay('Island Garden City of Samal', 'San Isidro'), '');
  assert.equal(canonicalBarangay('Island Garden City of Samal', 'San Isidro (Babak)'), 'San Isidro (Babak)');
  assert.equal(canonicalBarangay('Tagum City', 'Gredu'), '');
});

test('registration validates credentials without requiring an address', () => {
  const values = { firstName: 'Address', middleName: '', lastName: 'Test', phone: '09123456789', email: 'address@example.com', password: 'StrongPass1!', confirmPassword: 'StrongPass1!' };
  assert.deepEqual(validateRegistrationFields(values, true), {});
  assert.ok(validateRegistrationFields({ ...values, email: 'invalid' }, true).email);
  assert.ok(validateRegistrationFields(values, false).terms);
});

test('personal information owns full address validation and dependent barangay selection', () => {
  const values = { fullName: 'Address Test', email: 'address@example.com', phone: '09123456789', street: 'Purok 2', barangay: 'Visayan Village', city: 'Tagum City', postalCode: '8100' };
  assert.deepEqual(validatePersonalAddress(values), {});
  assert.ok(validatePersonalAddress({ ...values, city: 'Panabo City' }).barangay);
  assert.ok(validatePersonalAddress({ ...values, city: 'Davao City' }).city);
  assert.ok(validatePersonalAddress({ ...values, street: ' ' }).street);
  assert.ok(validatePersonalAddress({ ...values, postalCode: '123' }).postalCode);
  const shared = { ...values, barangay: 'San Miguel' };
  assert.equal(updatePersonalInformation(shared, 'city', 'Tagum City').barangay, 'San Miguel');
  const changed = updatePersonalInformation(shared, 'city', 'Santo Tomas');
  assert.equal(changed.barangay, ''); assert.equal(changed.street, 'Purok 2'); assert.equal(changed.postalCode, '8100');
  assert.equal(shared.barangay, 'San Miguel');
});

test('profile address contains only purok, barangay and city without extra separators', () => {
  assert.equal(profileAddress({ street: 'Purok 2', barangay: 'Visayan Village', city: 'Tagum City', postalCode: '8100', province: 'Davao del Norte' }), 'Purok 2, Visayan Village, Tagum City');
  assert.equal(profileAddress({ purok: 'Purok 2', barangay: 'Visayan Village', city: 'Tagum City' }), 'Purok 2, Visayan Village, Tagum City');
  assert.equal(profileAddress({ city: 'Tagum City' }), 'Tagum City');
  assert.equal(profileAddress({ city: '' }), '');
});

test('changing the city clears the barangay even when both cities share its name', () => {
  const original = { ...emptyCheckoutForm(), city: 'Tagum City', barangay: 'San Miguel', street: 'Purok 3' };
  assert.equal(updateCheckoutField(original, 'city', 'Tagum City').barangay, 'San Miguel');
  const changed = updateCheckoutField(original, 'city', 'Santo Tomas');
  assert.equal(changed.barangay, '');
  assert.equal(changed.street, 'Purok 3');
  assert.equal(updateCheckoutField(changed, 'barangay', 'San Miguel').barangay, 'San Miguel');
  assert.equal(original.barangay, 'San Miguel');
});

test('map autofill retains valid selections and clears unknown or mismatched barangays', () => {
  const form = { ...emptyCheckoutForm(), city: 'Tagum City', barangay: 'Visayan Village', street: 'Purok 2' };
  const pin = { coordinate: { latitude: 7.4482, longitude: 125.807 }, source: 'map', address: null };
  assert.equal(selectDeliveryLocation(form, pin).barangay, 'Visayan Village');
  const selected = (address) => selectDeliveryLocation(form, { ...pin, address: { label: 'Map result', province: 'Davao del Norte', ...address } });
  const tagum = selected({ city: 'Tagum', barangay: 'Brgy. Magugpo East' });
  assert.equal(tagum.city, 'Tagum City');
  assert.equal(tagum.barangay, 'Magugpo East');
  assert.equal(selected({ city: 'Tagum', barangay: 'Unknown district' }).barangay, '');
  assert.equal(selected({ city: 'Panabo', barangay: 'Visayan Village' }).barangay, '');
  assert.equal(selected({ city: 'Panabo' }).barangay, '');
  assert.equal(selected({ city: 'Panabo', barangay: 'Gredu (Poblacion)' }).barangay, 'Gredu');
});

test('delivery cannot be reviewed with a barangay from a different city', () => {
  const form = { ...emptyCheckoutForm('Receiver', '09123456789'), fulfillment: 'delivery', deliveryDate: tomorrowKey(), city: 'Tagum City', barangay: 'Visayan Village', street: 'Purok 2', postal: '8100', accessibleDestination: true, deliveryLocation: { coordinate: { latitude: 7.4482, longitude: 125.807 }, source: 'map', address: null } };
  assert.deepEqual(validateCheckout(form, { price: 100 }), {});
  assert.ok(validateCheckout({ ...form, city: 'Panabo City' }, { price: 100 }).barangay);
  assert.ok(validateCheckout({ ...form, city: 'Typed locality' }, { price: 100 }).city);
});
