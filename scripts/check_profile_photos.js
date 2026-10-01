const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createMessagingServer } = require('../server/server');

const photo = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jk1sAAAAASUVORK5CYII=';
const person = (fullName, email) => ({ fullName, email, password: 'Secure-test-2468', phone: '09123456789', city: 'Tagum City', street: 'Purok 1', barangay: 'Magugpo', postalCode: '8100', acceptedTerms: true });
async function start(databasePath = ':memory:') {
  const app = createMessagingServer({ databasePath, pollTimeout: 100 });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  return { ...app, url: `http://127.0.0.1:${app.server.address().port}` };
}
async function request(app, route, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(app.url + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...await response.json() };
}

test('profile photos are persistent, owner controlled and separate from ID verification', async (t) => {
  const app = await start(); t.after(() => app.close());
  const alice = await request(app, '/auth/register', null, person('Alice Member', 'alice@photo.test'));
  const bob = await request(app, '/auth/register', null, person('Bob Member', 'bob@photo.test'));
  let version;
  await t.test('initials remain the default and photo access requires sign-in', async () => {
    assert.equal(alice.account.avatarVersion, null);
    assert.equal((await request(app, '/auth/photo', alice.token)).status, 404);
    assert.equal((await request(app, '/auth/photo')).status, 401);
    assert.equal((await request(app, '/auth/photo', null, { photo })).status, 401);
  });
  await t.test('invalid image formats and photos exceeding the size limit are rejected', async () => {
    assert.equal((await request(app, '/auth/photo', alice.token, { photo: Buffer.from('<svg>not a photo</svg>').toString('base64') })).status, 400);
    assert.equal((await request(app, '/auth/photo', alice.token, { photo: Buffer.alloc(1024 * 1024 + 1).toString('base64') })).status, 413);
  });
  await t.test('saving updates only the owner and keeps image data out of session responses', async () => {
    const saved = await request(app, '/auth/photo', alice.token, { photo, userId: bob.account.id });
    assert.equal(saved.status, 200); version = saved.account.avatarVersion; assert.ok(version);
    assert.equal(JSON.stringify(saved.account).includes(photo), false);
    const ownerPhoto = await request(app, '/auth/photo', alice.token);
    assert.equal(ownerPhoto.photo, `data:image/png;base64,${photo}`); assert.equal(ownerPhoto.version, version);
    assert.equal((await request(app, '/auth/photo', bob.token)).status, 404);
    assert.equal((await request(app, `/auth/photo?userId=${alice.account.id}`, bob.token)).status, 404);
    assert.equal((await request(app, '/auth/me', bob.token)).account.avatarVersion, null);
  });
  await t.test('replacing a photo updates its version without changing ID submission', async () => {
    await request(app, '/verification/id', alice.token, { fullName: 'Alice Member', idType: 'National ID', photo, consent: true });
    const id = app.db.prepare('SELECT submission_id FROM identity_verifications WHERE user_id = ?').get(alice.account.id).submission_id;
    const replaced = await request(app, '/auth/photo', alice.token, { photo });
    assert.equal(replaced.account.verification.status, 'pending'); assert.notEqual(replaced.account.avatarVersion, version);
    assert.equal(app.db.prepare('SELECT COUNT(*) total FROM profile_photos WHERE user_id = ?').get(alice.account.id).total, 1);
    assert.equal(app.db.prepare('SELECT submission_id FROM identity_verifications WHERE user_id = ?').get(alice.account.id).submission_id, id);
  });
  await t.test('changing personal information preserves the photo and removal restores initials', async () => {
    const currentVersion = (await request(app, '/auth/me', alice.token)).account.avatarVersion;
    const edited = await request(app, '/auth/me', alice.token, person('Alice New Name', 'alice@photo.test'), 'PATCH');
    assert.equal(edited.account.avatarVersion, currentVersion);
    await request(app, '/auth/photo', bob.token, { photo });
    const removed = await request(app, '/auth/photo/remove', alice.token, { userId: bob.account.id });
    assert.equal(removed.account.avatarVersion, null);
    assert.equal((await request(app, '/auth/photo', alice.token)).status, 404);
    assert.equal((await request(app, '/auth/photo', bob.token)).status, 200);
    assert.equal((await request(app, '/auth/photo/remove', alice.token, {})).status, 200);
  });
});

test('profile picture survives logout, login and a server restart', async () => {
  const filename = path.resolve(__dirname, '../.expo', `profile_photo_${randomUUID()}.sqlite`);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  let app = await start(filename);
  try {
    const user = await request(app, '/auth/register', null, person('Photo Member', 'persist@photo.test'));
    const saved = await request(app, '/auth/photo', user.token, { photo });
    await request(app, '/auth/logout', user.token, {});
    assert.equal((await request(app, '/auth/photo', user.token)).status, 401);
    await app.close(); app = null;
    app = await start(filename);
    const loggedIn = await request(app, '/auth/login', null, { email: 'persist@photo.test', password: 'Secure-test-2468' });
    assert.equal(loggedIn.account.avatarVersion, saved.account.avatarVersion);
    assert.equal((await request(app, '/auth/photo', loggedIn.token)).photo, `data:image/png;base64,${photo}`);
  } finally {
    if (app) await app.close();
    for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(filename + suffix)) fs.unlinkSync(filename + suffix);
  }
});
