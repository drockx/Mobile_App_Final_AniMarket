const assert = require('node:assert/strict');
const test = require('node:test');
const { createMessagingServer } = require('../server/server');
const { passwordError, emailError } = require('../src/features/auth/domain/credential_policy');

test('passwords accept 8 and 21 characters, reject 7 and 22, and require every character type', () => {
  for (const value of ['Abcd12!x', 'A1!' + 'a'.repeat(18)]) assert.equal(passwordError(value), null);
  for (const value of ['Abc12!x', 'A1!' + 'a'.repeat(19), 'lowercase12!', 'UPPERCASE12!', 'NoNumbers!!', 'NoSymbols123', 'Abcd123 ']) assert.ok(passwordError(value), value);
});
test('email format is still validated', () => {
  assert.equal(emailError('sam+orders@example.com'), null);
  for (const value of ['bad', 'a@@gmail.com', 'a..b@gmail.com', 'a@-gmail.com']) assert.ok(emailError(value));
});
test('registration works without an email code while server password rules remain enforced', async (t) => {
  const app = createMessagingServer({ databasePath: ':memory:' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); t.after(() => app.close());
  const person = {fullName:'Security Test',email:'security@example.test',password:'Abcd12!x',phone:'09123456789',city:'Tagum City',street:'Purok 1',barangay:'Magugpo',postalCode:'8100',acceptedTerms:true};
  async function request(path, body, token) {
    const r = await fetch('http://127.0.0.1:' + app.server.address().port + path, {method:'POST',headers:{'Content-Type':'application/json',...(token ? {Authorization:'Bearer ' + token} : {})},body:JSON.stringify(body)});
    return {status:r.status,...await r.json()};
  }
  for (const password of ['Abc12!x', 'A1!' + 'a'.repeat(19), 'lowercase12!', 'UPPERCASE12!', 'NoNumbers!!', 'NoSymbols123']) assert.equal((await request('/auth/register',{...person,password})).status,400);
  assert.equal((await request('/auth/register',{...person,email:'bad@@email.com'})).status,400);
  const result = await request('/auth/register',person); assert.equal(result.status,201); assert.ok(result.token);
  assert.equal(app.db.prepare('SELECT email_verified_at FROM users WHERE id = ?').get(result.account.id).email_verified_at,null);
  assert.equal((await request('/auth/login',{email:person.email,password:person.password})).status,200);
  assert.equal((await request('/auth/register',person)).status,409);
  assert.equal((await request('/auth/password',{current:person.password,next:'A1!' + 'a'.repeat(19)},result.token)).status,400);
  assert.equal((await request('/auth/password',{current:person.password,next:'A1!' + 'a'.repeat(18)},result.token)).status,200);
});
test('an address can be added after registration and survives profile edits and sign-in', async (t) => {
  const app = createMessagingServer({ databasePath: ':memory:' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); t.after(() => app.close());
  const person = { fullName: 'Address Test', email: 'address@example.test', phone: '09123456789', password: 'StrongPass1!', acceptedTerms: true };
  async function request(path, body, token, method = 'POST') {
    const response = await fetch('http://127.0.0.1:' + app.server.address().port + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, ...await response.json() };
  }
  const created = await request('/auth/register', person); assert.equal(created.status, 201);
  assert.equal(created.account.personal.city, ''); assert.equal(created.account.personal.street, '');
  const personal = { ...created.account.personal, city: 'Tagum City', street: 'Purok 2', barangay: 'Visayan Village', postalCode: '8100' };
  const saved = await request('/auth/me', personal, created.token, 'PATCH'); assert.equal(saved.status, 200);
  assert.deepEqual(saved.account.personal, personal);
  const contactOnly = await request('/auth/me', { fullName: person.fullName, email: person.email, phone: '09987654321', city: 'Tagum City' }, created.token, 'PATCH');
  assert.equal(contactOnly.status, 200); assert.equal(contactOnly.account.personal.street, 'Purok 2');
  assert.equal((await request('/auth/me', { ...personal, postalCode: 'bad' }, created.token, 'PATCH')).status, 400);
  const restored = await request('/auth/login', { email: person.email, password: person.password });
  assert.equal(restored.account.personal.barangay, 'Visayan Village'); assert.equal(restored.account.personal.postalCode, '8100');
});
