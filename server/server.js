const http = require('node:http');
const path = require('node:path');
const { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const { networkInterfaces } = require('node:os');
const { openDatabase } = require('./database');
const { createIdentityVerification } = require('./identity_verification');
const { createProfilePhotos } = require('./profile_photos');
const { createVoiceCalls } = require('./voice_calls');
const { passwordError, emailError } = require('../src/features/auth/domain/credential_policy');

const hashPassword = promisify(scrypt);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const localities = new Set(['Asuncion', 'Braulio E. Dujali', 'Carmen', 'Kapalong', 'New Corella', 'Panabo City', 'Island Garden City of Samal', 'Sawata', 'Santo Tomas', 'Tagum City', 'Talaingod']);
class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function requireText(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ApiError(400, `Enter a valid ${label}.`);
  return value.trim();
}
function emailAddress(value) {
  const email = requireText(value, 'email address', 254).toLowerCase();
  const issue = emailError(email);
  if (issue) throw new ApiError(400, issue);
  return email;
}
function passwordValue(value) {
  const issue = passwordError(value);
  if (issue) throw new ApiError(400, issue);
  return value;
}
function personalValues(body) {
  const fullName = requireText(body.fullName, 'full name');
  const email = emailAddress(body.email);
  const phone = requireText(body.phone, 'phone number', 20);
  if (!/^[+\d\s()-]{7,20}$/.test(phone)) throw new ApiError(400, 'Enter a valid phone number.');
  if (!localities.has(body.city)) throw new ApiError(400, 'Choose a city or municipality in Davao del Norte.');
  return { fullName, email, phone, city: body.city };
}

function createMessagingServer({ databasePath = process.env.ANIMARKET_DATABASE || path.join(__dirname, 'data', 'animarket.sqlite'), allowedOrigins = process.env.ANIMARKET_ALLOWED_ORIGINS || '', pollTimeout = 25000, ringTimeout = 45000 } = {}) {
  const db = openDatabase(databasePath);
  const waiters = new Map();
  const rateLimits = new Map();
  const configuredOrigins = new Set(allowedOrigins.split(',').map((item) => item.trim()).filter(Boolean));
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  function transaction(action) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = action(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function notify(ids) {
    for (const id of new Set(ids)) {
      run('UPDATE users SET revision = revision + 1 WHERE id = ?', id);
      for (const wake of [...(waiters.get(id) || [])]) wake();
    }
  }
  const verification = createIdentityVerification({ db, databasePath, ApiError, notify });
  const profilePhotos = createProfilePhotos({ db, ApiError, notify });
  const calls = createVoiceCalls({ db, ApiError, notify, verification, ringTimeout });
  function publicAccount(row) {
    return { id: row.id, username: row.email, personal: { fullName: row.full_name, email: row.email, phone: row.phone, city: row.city }, verification: verification.status(row.id), isReviewer: Boolean(row.is_reviewer), avatarVersion: profilePhotos.version(row.id) };
  }
  function limit(key, count, windowMs) {
    const now = Date.now();
    let entry = rateLimits.get(key);
    if (!entry || entry.until < now) { entry = { count: 0, until: now + windowMs }; rateLimits.set(key, entry); }
    if (++entry.count > count) throw new ApiError(429, 'Too many requests. Please try again shortly.');
    if (rateLimits.size > 10000) for (const [storedKey, item] of rateLimits) if (item.until < now) rateLimits.delete(storedKey);
  }
  function authenticate(req) {
    const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) throw new ApiError(401, 'Please sign in to message another user.');
    const session = get('SELECT users.*, sessions.token_hash FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?', digest(token), Date.now());
    if (!session) throw new ApiError(401, 'Your session expired. Please sign in again.');
    return session;
  }
  function createSession(user) {
    const token = randomBytes(32).toString('hex');
    run('DELETE FROM sessions WHERE expires_at <= ?', Date.now());
    run('INSERT INTO sessions VALUES (?, ?, ?)', digest(token), user.id, Date.now() + 30 * 86400000);
    return { token, account: publicAccount(user) };
  }
  async function bodyJson(req, maximum = 16384) {
    let size = 0; const parts = [];
    for await (const part of req) {
      size += part.length;
      if (size > maximum) throw new ApiError(413, 'This upload is too large.');
      parts.push(part);
    }
    try { const value = JSON.parse(Buffer.concat(parts).toString()); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
    catch { throw new ApiError(400, 'Invalid request.'); }
  }
  function member(userId, conversationId) {
    const item = get('SELECT * FROM members WHERE conversation_id = ? AND user_id = ?', conversationId, userId);
    if (!item) throw new ApiError(404, 'Conversation not found.');
    return item;
  }
  function conversationList(userId) {
    return all(`SELECT c.*, u.id participant_id, u.full_name participant, u.city,
        mine.read_seq, other.read_seq other_read_seq,
        (SELECT MAX(seq) FROM messages WHERE conversation_id = c.id) last_seq,
        (SELECT text FROM messages WHERE conversation_id = c.id ORDER BY seq DESC LIMIT 1) preview,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY seq DESC LIMIT 1) sent_at,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != ? AND seq > mine.read_seq) unread_count
      FROM conversations c JOIN members mine ON mine.conversation_id = c.id AND mine.user_id = ?
      JOIN members other ON other.conversation_id = c.id AND other.user_id != mine.user_id
      JOIN users u ON u.id = other.user_id
      ORDER BY COALESCE(sent_at, c.created_at) DESC`, userId, userId).map((row) => ({
        id: row.id, side: row.initiator_id === userId ? 'buying' : 'selling', participantId: row.participant_id,
        participant: row.participant, initials: row.participant.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(),
        listing: row.listing_title || 'Direct message', listingId: row.listing_id || undefined,
        preview: row.preview || 'Start a conversation', updatedAt: row.sent_at || row.created_at,
        unreadCount: row.unread_count, verifiedSeller: verification.status(row.participant_id).status === 'verified', lastMessageSeq: row.last_seq || 0,
        readSeq: row.read_seq, otherReadSeq: row.other_read_seq,
      }));
  }
  function syncSnapshot(userId) {
    return { cursor: get('SELECT revision FROM users WHERE id = ?', userId).revision, conversations: conversationList(userId) };
  }
  function messageDto(row) {
    return { id: row.id, seq: row.seq, conversationId: row.conversation_id, senderId: row.sender_id, clientId: row.client_id, text: row.text, createdAt: row.created_at };
  }
  const server = http.createServer(async (req, res) => {
    const respond = (status, value) => { if (!res.destroyed && !res.writableEnded) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); } };
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const origin = req.headers.origin;
      if (origin) {
        const developmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);
        if (!configuredOrigins.has(origin) && !(process.env.NODE_ENV !== 'production' && developmentOrigin)) throw new ApiError(403, 'This app origin is not allowed.');
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
      }
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health' && req.method === 'GET') { respond(200, { ok: true }); return; }
      if (['/auth/register', '/auth/login'].includes(url.pathname) && req.method === 'POST') {
        limit(`auth:${req.socket.remoteAddress}`, 30, 15 * 60000);
        const body = await bodyJson(req);
        if (url.pathname === '/auth/register') {
          const person = personalValues(body); const password = passwordValue(body.password);
          if (body.acceptedTerms !== true) throw new ApiError(400, 'Please agree to the terms and privacy policy.');
          const address = { street: requireText(body.street, 'street'), barangay: requireText(body.barangay, 'barangay'), postalCode: requireText(body.postalCode, 'postal code', 4) };
          if (!/^\d{4}$/.test(address.postalCode)) throw new ApiError(400, 'Postal code must contain four digits.');
          if (get('SELECT id FROM users WHERE email = ?', person.email)) throw new ApiError(409, 'This email address is already registered.');
          const salt = randomBytes(16).toString('hex');
          const passwordHash = (await hashPassword(password, salt, 64)).toString('hex');
          const id = randomUUID();
          run('INSERT INTO users (id, email, full_name, phone, city, address, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id, person.email, person.fullName, person.phone, person.city, JSON.stringify(address), passwordHash, salt, new Date().toISOString());
          respond(201, createSession(get('SELECT * FROM users WHERE id = ?', id))); return;
        }
        const email = emailAddress(body.email);
        if (typeof body.password !== 'string' || body.password.length > 128) throw new ApiError(400, 'Enter your password.');
        const user = get('SELECT * FROM users WHERE email = ?', email);
        const candidate = await hashPassword(body.password, user?.salt || 'unknown-account-salt', 64);
        if (!user || !timingSafeEqual(candidate, Buffer.from(user.password_hash, 'hex'))) throw new ApiError(401, 'Email or password is incorrect.');
        respond(200, createSession(user)); return;
      }
      const user = authenticate(req);
      verification.expire();
      if (url.pathname.startsWith('/calls') && url.pathname !== '/calls/sync') {
        limit(`calls:${user.id}`, 240, 60000);
        if (url.pathname === '/calls' && req.method === 'POST') limit(`start-call:${user.id}`, 20, 60000);
        if (await calls.handle({ user, req, url, bodyJson, respond })) return;
      }
      if (['/auth/photo', '/auth/photo/remove'].includes(url.pathname)) {
        limit(`profile-photo:${user.id}`, 30, 60000);
        if (await profilePhotos.handle({ user, req, url, bodyJson, respond, account: publicAccount })) return;
      }
      if (url.pathname.startsWith('/verification/')) {
        limit(`verification:${user.id}`, 60, 60000);
        if (await verification.handle({ user, req, url, bodyJson, respond, account: publicAccount })) return;
      }
      if (url.pathname === '/auth/me' && req.method === 'GET') { respond(200, { account: publicAccount(user) }); return; }
      if (url.pathname === '/auth/logout' && req.method === 'POST') {
        calls.endForUser(user.id);
        run('DELETE FROM sessions WHERE token_hash = ?', user.token_hash); notify([user.id]); respond(200, { ok: true }); return;
      }
      if (url.pathname === '/auth/password' && req.method === 'POST') {
        limit(`password:${user.id}`, 10, 15 * 60000);
        const body = await bodyJson(req); const next = passwordValue(body.next);
        if (typeof body.current !== 'string' || body.current.length > 128) throw new ApiError(400, 'Enter your current password.');
        const current = await hashPassword(body.current, user.salt, 64);
        if (!timingSafeEqual(current, Buffer.from(user.password_hash, 'hex'))) throw new ApiError(400, 'Current password is incorrect.');
        const salt = randomBytes(16).toString('hex'); const hash = (await hashPassword(next, salt, 64)).toString('hex');
        transaction(() => { run('UPDATE users SET salt = ?, password_hash = ? WHERE id = ?', salt, hash, user.id); run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', user.id, user.token_hash); });
        notify([user.id]); respond(200, { ok: true }); return;
      }
      if (url.pathname === '/auth/me' && req.method === 'PATCH') {
        const body = await bodyJson(req); const person = personalValues(body);
        const emailChanged = person.email !== user.email;
        if (emailChanged) {
          limit(`email-change:${user.id}`, 10, 15 * 60000);
          if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 128) throw new ApiError(400, 'Enter your current password to change your email.');
          const candidate = await hashPassword(body.currentPassword, user.salt, 64);
          const freshUser = authenticate(req);
          if (!timingSafeEqual(candidate, Buffer.from(freshUser.password_hash, 'hex'))) throw new ApiError(400, 'Current password is incorrect.');
        }
        const current = get('SELECT * FROM users WHERE id = ?', user.id);
        run('UPDATE users SET email = ?, full_name = ?, phone = ?, city = ?, email_verified_at = ? WHERE id = ?', person.email, person.fullName, person.phone, person.city, emailChanged ? null : current.email_verified_at, user.id);
        if (person.fullName !== current.full_name) verification.invalidateName(user.id);
        const peers = all('SELECT DISTINCT other.user_id FROM members mine JOIN members other ON mine.conversation_id = other.conversation_id WHERE mine.user_id = ?', user.id).map((row) => row.user_id);
        notify([user.id, ...peers]); respond(200, { account: publicAccount(get('SELECT * FROM users WHERE id = ?', user.id)) }); return;
      }
      if (url.pathname === '/users' && req.method === 'GET') {
        limit(`directory:${user.id}`, 60, 60000);
        const query = (url.searchParams.get('q') || '').trim().slice(0, 120).toLowerCase();
        if (query.length < 2) { respond(200, { users: [] }); return; }
        const pattern = `%${query.replace(/[!%_]/g, '!$&')}%`;
        const users = all("SELECT id, full_name, city FROM users WHERE id != ? AND (LOWER(full_name) LIKE ? ESCAPE '!' OR LOWER(email) = ?) ORDER BY full_name LIMIT 30", user.id, pattern, query);
        respond(200, { users: users.map((row) => ({ id: row.id, fullName: row.full_name, city: row.city })) }); return;
      }
      if (url.pathname === '/conversations' && req.method === 'POST') {
        limit(`new-chat:${user.id}`, 30, 60000);
        const body = await bodyJson(req); const recipientId = requireText(body.recipientId, 'recipient', 50);
        if (recipientId === user.id) throw new ApiError(400, 'Choose another user to message.');
        if (!get('SELECT id FROM users WHERE id = ?', recipientId)) throw new ApiError(404, 'This user was not found.');
        // Listing ownership must come from a future shared listing repository. Never trust a supplied seller name.
        if (body.listingId || body.listingTitle) throw new ApiError(400, 'Start a direct conversation with a registered user.');
        const pairKey = [user.id, recipientId].sort().join(':');
        let existing = get("SELECT id FROM conversations WHERE pair_key = ? AND listing_id = ''", pairKey);
        if (!existing) {
          const id = randomUUID();
          transaction(() => { run('INSERT INTO conversations (id, initiator_id, recipient_id, pair_key, created_at) VALUES (?, ?, ?, ?, ?)', id, user.id, recipientId, pairKey, new Date().toISOString()); run('INSERT INTO members (conversation_id, user_id) VALUES (?, ?), (?, ?)', id, user.id, id, recipientId); });
          existing = { id }; notify([user.id, recipientId]);
        }
        respond(200, { conversation: conversationList(user.id).find((item) => item.id === existing.id) }); return;
      }
      const thread = url.pathname.match(/^\/conversations\/([^/]+)\/(messages|read)$/);
      if (thread) {
        const [, conversationId, action] = thread; member(user.id, conversationId);
        if (action === 'messages' && req.method === 'GET') {
          const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
          const after = Math.max(0, Number(url.searchParams.get('after')) || 0);
          const ascending = url.searchParams.has('after');
          const rows = all(`SELECT * FROM messages WHERE conversation_id = ? AND seq < ? AND seq > ? ORDER BY seq ${ascending ? 'ASC' : 'DESC'} LIMIT 61`, conversationId, before, after);
          const hasMore = rows.length > 60; const page = rows.slice(0, 60);
          respond(200, { messages: (ascending ? page : page.reverse()).map(messageDto), hasMore }); return;
        }
        if (action === 'messages' && req.method === 'POST') {
          limit(`send:${user.id}`, 120, 60000);
          const body = await bodyJson(req); const text = requireText(body.text, 'message (up to 2,000 characters)', 2000); const clientId = requireText(body.clientId, 'message identifier', 80);
          const existing = get('SELECT * FROM messages WHERE conversation_id = ? AND sender_id = ? AND client_id = ?', conversationId, user.id, clientId);
          if (existing) { if (existing.text !== text) throw new ApiError(409, 'Message identifier already used.'); respond(200, { message: messageDto(existing) }); return; }
          const id = randomUUID(); run('INSERT INTO messages (id, conversation_id, sender_id, client_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, conversationId, user.id, clientId, text, new Date().toISOString());
          notify(all('SELECT user_id FROM members WHERE conversation_id = ?', conversationId).map((row) => row.user_id));
          respond(201, { message: messageDto(get('SELECT * FROM messages WHERE id = ?', id)) }); return;
        }
        if (action === 'read' && req.method === 'POST') {
          const body = await bodyJson(req); const throughSeq = Number(body.throughSeq);
          if (!Number.isSafeInteger(throughSeq) || throughSeq < 0) throw new ApiError(400, 'Invalid read receipt.');
          const last = get('SELECT MAX(seq) seq FROM messages WHERE conversation_id = ?', conversationId).seq || 0;
          const result = run('UPDATE members SET read_seq = ? WHERE conversation_id = ? AND user_id = ? AND read_seq < ?', Math.min(last, throughSeq), conversationId, user.id, Math.min(last, throughSeq));
          if (result.changes) notify(all('SELECT user_id FROM members WHERE conversation_id = ?', conversationId).map((row) => row.user_id));
          respond(200, { ok: true }); return;
        }
      }
      if (['/sync', '/calls/sync'].includes(url.pathname) && req.method === 'GET') {
        const snapshot = () => url.pathname === '/calls/sync' ? calls.snapshot(user.id, url.searchParams) : syncSnapshot(user.id);
        const cursor = Number(url.searchParams.get('cursor'));
        if (!url.searchParams.has('cursor') || cursor !== user.revision) { respond(200, snapshot()); return; }
        let pending = waiters.get(user.id);
        if (!pending) { pending = new Set(); waiters.set(user.id, pending); }
        if (pending.size >= 8) throw new ApiError(429, 'Too many active chat connections.');
        const finish = () => {
          clearTimeout(timer); pending.delete(finish); if (!pending.size) waiters.delete(user.id);
          if (res.destroyed || res.writableEnded) return;
          try { authenticate(req); respond(200, snapshot()); }
          catch (error) { respond(error.status || 500, { error: error.message }); }
        };
        const timer = setTimeout(finish, pollTimeout); pending.add(finish);
        res.on('close', () => { clearTimeout(timer); pending.delete(finish); if (!pending.size) waiters.delete(user.id); });
        return;
      }
      throw new ApiError(404, 'Endpoint not found.');
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed: users.email')) respond(409, { error: 'This email address is already registered.' });
      else { if (!(error instanceof ApiError)) console.error('Messaging request failed:', error.code || error.name); respond(error.status || 500, { error: error instanceof ApiError ? error.message : 'Unable to complete your request. Please try again.' }); }
    }
  });
  server.requestTimeout = 35000;
  return { server, db, async close() { calls.close(); verification.close(); for (const pending of waiters.values()) for (const wake of [...pending]) wake(); await new Promise((resolve) => server.close(resolve)); db.close(); } };
}

if (require.main === module) {
  const port = Number(process.env.ANIMARKET_PORT || 3001); const app = createMessagingServer();
  app.server.listen(port, '0.0.0.0', () => {
    console.log(`AniMarket messaging: http://localhost:${port}`);
    for (const interfaces of Object.values(networkInterfaces())) for (const item of interfaces || []) if (item.family === 'IPv4' && !item.internal) console.log(`Phone on the same Wi-Fi: http://${item.address}:${port}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void app.close().then(() => process.exit(0)); });
}
module.exports = { createMessagingServer };
