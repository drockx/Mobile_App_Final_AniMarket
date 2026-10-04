const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createMessagingServer } = require('../server/server');

const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jk1sAAAAASUVORK5CYII=';
const person = (fullName, email) => ({ fullName, email, phone: '09123456789', password: 'Secure-test-2468', city: 'Tagum City', street: 'Purok 1', barangay: 'Magugpo', postalCode: '8100', acceptedTerms: true });
async function start(databasePath = ':memory:') {
  const app = createMessagingServer({ databasePath, pollTimeout: 100 });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  return { ...app, url: `http://127.0.0.1:${app.server.address().port}` };
}
async function request(app, route, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(app.url + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...await response.json() };
}
const submission = (fullName) => ({ fullName, idType: 'National ID', photo: image, consent: true });

test('verification requires an address saved in Personal Information before accepting an ID', async (t) => {
  const app = await start(); t.after(() => app.close());
  const complete = person('Address Required', 'address@example.test');
  const { city, street, barangay, postalCode, ...registration } = complete;
  const user = await request(app, '/auth/register', null, registration); assert.equal(user.status, 201);
  const missing = await request(app, '/verification/id', user.token, submission(complete.fullName));
  assert.equal(missing.status, 409); assert.match(missing.error, /Personal Information/);
  assert.equal(app.db.prepare('SELECT * FROM identity_verifications WHERE user_id = ?').get(user.account.id), undefined);
  const saved = await request(app, '/auth/me', user.token, { ...registration, city, street, barangay, postalCode }, 'PATCH');
  assert.equal(saved.status, 200);
  assert.equal((await request(app, '/verification/id', user.token, submission(complete.fullName))).account.verification.status, 'pending');
});

test('valid ID submission, private review, real status and withdrawal', async (t) => {
  const app = await start(); t.after(() => app.close());
  const seller = await request(app, '/auth/register', null, { ...person('Sam Seller', 'sam@example.test'), isReviewer: true, verification: { status: 'verified' } });
  const buyer = await request(app, '/auth/register', null, person('Ben Buyer', 'ben@example.test'));
  const reviewer = await request(app, '/auth/register', null, person('Rae Reviewer', 'rae@example.test'));
  const id = seller.account.id;
  const row = () => app.db.prepare('SELECT * FROM identity_verifications WHERE user_id = ?').get(id);
  let original;
  await t.test('registration requires no DTI document and cannot self-assign verification or reviewer access', async () => {
    assert.equal(seller.status, 201); assert.equal(seller.account.verification.status, 'unverified'); assert.equal(seller.account.isReviewer, false);
    assert.equal((await request(app, '/verification/eligibility', seller.token)).status, 403);
    assert.equal((await request(app, '/verification/reviews', seller.token)).status, 403);
    assert.equal((await request(app, '/verification/id')).status, 401);
  });
  await t.test('submission checks consent, account name, ID type and actual image bytes', async () => {
    for (const extra of [{ consent: false }, { idType: 'DTI registration' }, { photo: 'ZmFrZS1pbWFnZQ==' }]) {
      assert.equal((await request(app, '/verification/id', seller.token, { ...submission('Sam Seller'), ...extra })).status, 400);
    }
    assert.equal((await request(app, '/verification/id', seller.token, submission('Another Name'))).status, 409);
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64');
    assert.equal((await request(app, '/verification/id', seller.token, { ...submission('Sam Seller'), photo: oversized })).status, 413);
  });
  await t.test('upload becomes pending, encrypts the photo and rejects duplicate submission', async () => {
    const result = await request(app, '/verification/id', seller.token, { ...submission('Sam Seller'), decision: 'verified', isReviewer: true });
    assert.equal(result.status, 201); assert.equal(result.account.verification.status, 'pending');
    assert.equal((await request(app, '/verification/eligibility', seller.token)).status, 403);
    const stored = Buffer.from(row().photo);
    assert.equal(stored.includes(Buffer.from(image, 'base64')), false); assert.ok(row().consent_at);
    assert.equal((await request(app, '/verification/id', seller.token, submission('Sam Seller'))).status, 409);
    original = row().submission_id;
  });
  await t.test('only the owner and authorized reviewer can retrieve the ID photo', async () => {
    const owner = await request(app, '/verification/id', seller.token);
    assert.equal(owner.photo, `data:image/png;base64,${image}`);
    assert.equal((await request(app, `/verification/reviews/${id}`, buyer.token)).status, 403);
    assert.equal((await request(app, `/verification/id?userId=${id}`, buyer.token)).status, 404);
    const directory = await request(app, '/users?q=Sam', buyer.token);
    assert.equal(JSON.stringify(directory).includes(image), false);
    app.db.prepare('UPDATE users SET is_reviewer = 1 WHERE id = ?').run(reviewer.account.id);
    assert.equal((await request(app, '/auth/me', reviewer.token)).account.isReviewer, true);
    const queue = await request(app, '/verification/reviews', reviewer.token);
    assert.equal(queue.reviews[0].userId, id); assert.equal(queue.reviews[0].photo, undefined);
    assert.equal((await request(app, `/verification/reviews/${id}`, reviewer.token)).photo, owner.photo);
  });
  await t.test('reviews reject stale decisions, require feedback for resubmission and prevent self-review', async () => {
    assert.equal((await request(app, `/verification/reviews/${id}`, reviewer.token, { submissionId: 'old', decision: 'verified' })).status, 409);
    assert.equal((await request(app, `/verification/reviews/${id}`, reviewer.token, { submissionId: original, decision: 'rejected' })).status, 400);
    await request(app, '/verification/id', reviewer.token, submission('Rae Reviewer'));
    assert.equal((await request(app, `/verification/reviews/${reviewer.account.id}`, reviewer.token)).status, 403);
    assert.equal((await request(app, `/verification/reviews/${reviewer.account.id}`, reviewer.token, { submissionId: 'anything', decision: 'verified' })).status, 403);
  });
  await t.test('approval enables selling, updates chat badges and removes the stored image', async () => {
    await request(app, '/conversations', buyer.token, { recipientId: id });
    assert.equal((await request(app, '/sync', buyer.token)).conversations[0].verifiedSeller, false);
    const approved = await request(app, `/verification/reviews/${id}`, reviewer.token, { submissionId: original, decision: 'verified' });
    assert.equal(approved.status, 200); assert.equal(row().photo, null); assert.equal(row().reviewed_by, reviewer.account.id);
    assert.equal((await request(app, '/auth/me', seller.token)).account.verification.status, 'verified');
    assert.equal((await request(app, '/verification/eligibility', seller.token)).status, 200);
    assert.equal((await request(app, '/sync', buyer.token)).conversations[0].verifiedSeller, true);
    assert.equal((await request(app, '/verification/id', seller.token)).status, 404);
    assert.equal((await request(app, `/verification/reviews/${id}`, reviewer.token, { submissionId: original, decision: 'verified' })).status, 409);
  });
  await t.test('changing the account name invalidates verification and seller eligibility', async () => {
    const changed = await request(app, '/auth/me', seller.token, { ...person('Sam New Name', 'sam@example.test'), verification: { status: 'verified' }, isReviewer: true }, 'PATCH');
    assert.equal(changed.account.verification.status, 'unverified'); assert.equal(changed.account.isReviewer, false); assert.equal(row(), undefined);
    assert.equal((await request(app, '/verification/eligibility', seller.token)).status, 403);
    assert.equal((await request(app, '/sync', buyer.token)).conversations[0].verifiedSeller, false);
  });
  await t.test('rejection keeps useful feedback, removes the photo and allows a new submission', async () => {
    await request(app, '/verification/id', seller.token, submission('Sam New Name'));
    const second = row().submission_id;
    assert.equal((await request(app, `/verification/reviews/${id}`, reviewer.token, { submissionId: second, decision: 'rejected', reason: 'Please include all four edges of the ID.' })).status, 200);
    assert.equal(row().photo, null);
    const rejected = (await request(app, '/auth/me', seller.token)).account.verification;
    assert.equal(rejected.status, 'rejected'); assert.equal(rejected.reason, 'Please include all four edges of the ID.');
    await request(app, '/verification/id', seller.token, { ...submission('Sam New Name'), idType: 'Other valid photo ID' });
    assert.equal(row().status, 'pending'); assert.notEqual(row().submission_id, second); assert.equal(row().reason, null);
    assert.equal((await request(app, `/verification/reviews/${id}`, reviewer.token, { submissionId: second, decision: 'verified' })).status, 409);
  });
  await t.test('pending IDs expire after 30 days and withdrawal removes submitted data', async () => {
    app.db.prepare('UPDATE identity_verifications SET expires_at = ? WHERE user_id = ?').run('2020-01-01T00:00:00.000Z', id);
    assert.equal((await request(app, '/auth/me', seller.token)).account.verification.status, 'expired');
    assert.equal(row().photo, null);
    await request(app, '/verification/id', seller.token, submission('Sam New Name'));
    assert.equal((await request(app, '/verification/withdraw', seller.token, {})).account.verification.status, 'unverified');
    assert.equal(row(), undefined);
    assert.equal((await request(app, '/verification/id', seller.token)).status, 404);
  });
});

test('pending ID encryption and review status survive a server restart', async () => {
  const filename = path.resolve(__dirname, '../.expo', `verification_${randomUUID()}.sqlite`);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  let app = await start(filename);
  try {
    const user = await request(app, '/auth/register', null, person('Persistent Seller', 'persist@example.test'));
    await request(app, '/verification/id', user.token, submission('Persistent Seller'));
    const encrypted = Buffer.from(app.db.prepare('SELECT photo FROM identity_verifications').get().photo);
    await app.close(); app = null;
    app = await start(filename);
    assert.equal((await request(app, '/auth/me', user.token)).account.verification.status, 'pending');
    assert.equal((await request(app, '/verification/id', user.token)).photo, `data:image/png;base64,${image}`);
    assert.deepEqual(Buffer.from(app.db.prepare('SELECT photo FROM identity_verifications').get().photo), encrypted);
  } finally {
    if (app) await app.close();
    for (const suffix of ['', '-wal', '-shm', '.id.key']) if (fs.existsSync(filename + suffix)) fs.unlinkSync(filename + suffix);
  }
});
