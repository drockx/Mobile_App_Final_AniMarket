const { randomBytes, randomUUID, createCipheriv, createDecipheriv } = require('node:crypto');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');

const ID_TYPES = new Set(['National ID', 'Passport', "Driver’s license", 'UMID', 'Other valid photo ID']);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function createIdentityVerification({ db, databasePath, ApiError, notify }) {
  const get = (sql, ...values) => db.prepare(sql).get(...values);
  const run = (sql, ...values) => db.prepare(sql).run(...values);
  let encryptionKey;
  function key() {
    if (encryptionKey) return encryptionKey;
    if (databasePath === ':memory:') return (encryptionKey = randomBytes(32));
    const filename = `${databasePath}.id.key`;
    if (existsSync(filename)) encryptionKey = readFileSync(filename);
    else {
      if (get('SELECT user_id FROM identity_verifications WHERE photo IS NOT NULL LIMIT 1')) throw new Error('ID encryption key is missing');
      encryptionKey = randomBytes(32);
      writeFileSync(filename, encryptionKey, { flag: 'wx', mode: 0o600 });
    }
    if (encryptionKey.length !== 32) throw new Error('Invalid ID encryption key');
    return encryptionKey;
  }
  function encrypt(photo, userId) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key(), iv);
    cipher.setAAD(Buffer.from(userId));
    const ciphertext = Buffer.concat([cipher.update(photo), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  }
  function decrypt(row) {
    const photo = Buffer.from(row.photo);
    const cipher = createDecipheriv('aes-256-gcm', key(), photo.subarray(0, 12));
    cipher.setAAD(Buffer.from(row.user_id));
    cipher.setAuthTag(photo.subarray(12, 28));
    return Buffer.concat([cipher.update(photo.subarray(28)), cipher.final()]).toString('base64');
  }
  function expire() {
    const rows = db.prepare("SELECT user_id FROM identity_verifications WHERE status = 'pending' AND expires_at <= ?").all(new Date().toISOString());
    if (rows.length) {
      run("UPDATE identity_verifications SET status = 'expired', photo = NULL, reason = 'Your submission expired. Please submit a new ID photo.' WHERE status = 'pending' AND expires_at <= ?", new Date().toISOString());
      notify(rows.map((row) => row.user_id));
    }
  }
  function status(userId) {
    const row = get('SELECT * FROM identity_verifications WHERE user_id = ?', userId);
    if (!row) return { status: 'unverified' };
    return { status: row.status, idType: row.id_type, submittedAt: row.submitted_at, reviewedAt: row.reviewed_at, reason: row.reason || undefined };
  }
  function changed(userId) {
    const peers = db.prepare('SELECT DISTINCT other.user_id FROM members mine JOIN members other ON mine.conversation_id = other.conversation_id WHERE mine.user_id = ?').all(userId);
    notify([userId, ...peers.map((row) => row.user_id)]);
  }
  function invalidateName(userId) {
    run('DELETE FROM identity_verifications WHERE user_id = ?', userId);
  }
  function requireReviewer(user) {
    if (!get('SELECT is_reviewer FROM users WHERE id = ?', user.id)?.is_reviewer) throw new ApiError(403, 'Reviewer access is required.');
  }
  function photoDto(row) {
    if (!row?.photo || row.status !== 'pending') throw new ApiError(404, 'No pending ID photo is available.');
    return { userId: row.user_id, submissionId: row.submission_id, fullName: row.submitted_name, idType: row.id_type, submittedAt: row.submitted_at, photo: `data:${row.mime_type};base64,${decrypt(row)}` };
  }
  async function handle({ user, req, url, bodyJson, respond, account }) {
    if (!url.pathname.startsWith('/verification/')) return false;
    expire();
    if (url.pathname === '/verification/id' && req.method === 'POST') {
      const body = await bodyJson(req, Math.ceil(MAX_PHOTO_BYTES * 4 / 3) + 4096);
      const current = get('SELECT * FROM users WHERE id = ?', user.id);
      if (body.consent !== true) throw new ApiError(400, 'Please consent to ID verification before submitting.');
      if (body.fullName !== current.full_name) throw new ApiError(409, 'Your account name changed. Refresh and submit again.');
      if (!ID_TYPES.has(body.idType)) throw new ApiError(400, 'Choose a valid photo ID type.');
      if (typeof body.photo !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.photo) || body.photo.length % 4 !== 0) throw new ApiError(400, 'Choose a JPEG or PNG photo of your valid ID.');
      const photo = Buffer.from(body.photo, 'base64');
      if (photo.length > MAX_PHOTO_BYTES) throw new ApiError(413, 'Choose an ID photo smaller than 5 MB.');
      const png = photo.length > 45 && photo.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && photo.subarray(12, 16).toString() === 'IHDR' && photo.subarray(-8, -4).toString() === 'IEND';
      const jpeg = photo.length > 4 && photo.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) && photo.subarray(-2).equals(Buffer.from('ffd9', 'hex'));
      if (!png && !jpeg) throw new ApiError(400, 'Choose a JPEG or PNG photo of your valid ID.');
      const existing = status(user.id);
      if (existing.status === 'pending' || existing.status === 'verified') throw new ApiError(409, 'Your ID is already submitted.');
      const now = new Date().toISOString();
      run(`INSERT INTO identity_verifications (user_id, submission_id, status, id_type, submitted_name, photo, mime_type, consent_at, submitted_at, expires_at)
        VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET
        submission_id = excluded.submission_id, status = 'pending', id_type = excluded.id_type, submitted_name = excluded.submitted_name,
        photo = excluded.photo, mime_type = excluded.mime_type, consent_at = excluded.consent_at, submitted_at = excluded.submitted_at,
        expires_at = excluded.expires_at, reviewed_at = NULL, reviewed_by = NULL, reason = NULL`,
      user.id, randomUUID(), body.idType, current.full_name, encrypt(photo, user.id), png ? 'image/png' : 'image/jpeg', now, now, new Date(Date.now() + 30 * 86400000).toISOString());
      changed(user.id); respond(201, { account: account(current) }); return true;
    }
    if (url.pathname === '/verification/id' && req.method === 'GET') {
      respond(200, photoDto(get('SELECT * FROM identity_verifications WHERE user_id = ?', user.id))); return true;
    }
    if (url.pathname === '/verification/withdraw' && req.method === 'POST') {
      invalidateName(user.id); changed(user.id); respond(200, { account: account(user) }); return true;
    }
    if (url.pathname === '/verification/eligibility' && req.method === 'GET') {
      if (status(user.id).status !== 'verified') throw new ApiError(403, 'Verify your valid ID in Profile before publishing a listing.');
      respond(200, { account: account(user) }); return true;
    }
    if (url.pathname === '/verification/reviews' && req.method === 'GET') {
      requireReviewer(user);
      const reviews = db.prepare(`SELECT v.user_id userId, v.submission_id submissionId, v.submitted_name fullName,
        v.id_type idType, v.submitted_at submittedAt, u.city FROM identity_verifications v JOIN users u ON u.id = v.user_id
        WHERE v.status = 'pending' AND v.user_id != ? ORDER BY v.submitted_at LIMIT 50`).all(user.id);
      respond(200, { reviews }); return true;
    }
    const review = url.pathname.match(/^\/verification\/reviews\/([^/]+)$/);
    if (review) {
      requireReviewer(user);
      const userId = review[1];
      if (userId === user.id) throw new ApiError(403, 'Another reviewer must check your ID.');
      if (req.method === 'GET') { respond(200, photoDto(get('SELECT * FROM identity_verifications WHERE user_id = ?', userId))); return true; }
      if (req.method === 'POST') {
        const body = await bodyJson(req);
        const row = get('SELECT * FROM identity_verifications WHERE user_id = ?', userId);
        if (!row || row.status !== 'pending' || row.submission_id !== body.submissionId) throw new ApiError(409, 'This submission changed. Refresh the review queue.');
        if (!['verified', 'rejected'].includes(body.decision)) throw new ApiError(400, 'Choose approve or request a new photo.');
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        if (body.decision === 'rejected' && (!reason || reason.length > 300)) throw new ApiError(400, 'Explain what the user must correct (up to 300 characters).');
        run('UPDATE identity_verifications SET status = ?, reviewed_at = ?, reviewed_by = ?, reason = ?, photo = NULL WHERE user_id = ?', body.decision, new Date().toISOString(), user.id, body.decision === 'rejected' ? reason : null, userId);
        changed(userId); respond(200, { ok: true }); return true;
      }
    }
    throw new ApiError(404, 'Verification action not found.');
  }
  const timer = setInterval(expire, 60 * 60000); timer.unref();
  return { handle, status, expire, invalidateName, close: () => clearInterval(timer) };
}
module.exports = { createIdentityVerification };
