const { randomUUID, createHmac } = require('node:crypto');

function createVoiceCalls({ db, ApiError, notify, verification, ringTimeout = 45000 }) {
  db.exec(`CREATE TABLE IF NOT EXISTS voice_calls (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    caller_id TEXT NOT NULL REFERENCES users(id), callee_id TEXT NOT NULL REFERENCES users(id),
    client_id TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL,
    accepted_at INTEGER, connected_at INTEGER, ended_at INTEGER, reason TEXT,
    caller_seen INTEGER NOT NULL, callee_seen INTEGER NOT NULL,
    caller_connected INTEGER NOT NULL DEFAULT 0, callee_connected INTEGER NOT NULL DEFAULT 0,
    UNIQUE(caller_id, client_id)
  );
  CREATE INDEX IF NOT EXISTS voice_call_participants ON voice_calls(caller_id, callee_id, status);
  CREATE TABLE IF NOT EXISTS voice_signals (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, call_id TEXT NOT NULL REFERENCES voice_calls(id),
    sender_id TEXT NOT NULL REFERENCES users(id), client_id TEXT NOT NULL,
    type TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(call_id, sender_id, client_id)
  );`);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const active = (call) => ['ringing', 'accepted'].includes(call.status);
  const members = (call) => [call.caller_id, call.callee_id];
  function authorize(id, userId) {
    const call = get('SELECT * FROM voice_calls WHERE id = ? AND (caller_id = ? OR callee_id = ?)', id, userId, userId);
    if (!call) throw new ApiError(404, 'Call not found.');
    return call;
  }
  function dto(call, userId) {
    if (!call) return null;
    const peerId = call.caller_id === userId ? call.callee_id : call.caller_id;
    const person = get('SELECT id, full_name, city FROM users WHERE id = ?', peerId);
    return { id: call.id, conversationId: call.conversation_id, callerId: call.caller_id, calleeId: call.callee_id,
      status: call.status, createdAt: call.created_at, acceptedAt: call.accepted_at,
      connectedAt: call.connected_at, endedAt: call.ended_at, reason: call.reason,
      peer: { id: person.id, name: person.full_name, city: person.city,
        initials: person.full_name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(),
        verified: verification.status(peerId).status === 'verified' } };
  }
  function finish(call, status, reason) {
    run('UPDATE voice_calls SET status = ?, ended_at = ?, reason = ? WHERE id = ?', status, Date.now(), reason, call.id);
    // SDP/ICE contain network addresses. Keep only the call summary after hangup.
    run('DELETE FROM voice_signals WHERE call_id = ?', call.id);
    const duration = call.connected_at ? Math.max(0, Math.floor((Date.now() - call.connected_at) / 1000)) : 0;
    const text = status === 'missed' ? 'Missed voice call' : status === 'declined' ? 'Voice call declined'
      : call.connected_at ? `Voice call · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : reason === 'connection-lost' ? 'Voice call failed' : 'Voice call cancelled';
    run('INSERT OR IGNORE INTO messages (id, conversation_id, sender_id, client_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)', randomUUID(), call.conversation_id, call.caller_id, `voice-call:${call.id}`, text, new Date().toISOString());
    notify(members(call));
  }
  function expire() {
    const now = Date.now();
    for (const call of all("SELECT * FROM voice_calls WHERE status IN ('ringing', 'accepted')")) {
      if (call.status === 'ringing' && now - call.created_at > ringTimeout) finish(call, 'missed', 'no-answer');
      else if (now - call.caller_seen > 40000 || (call.status === 'accepted' && now - call.callee_seen > 40000)
        || (call.status === 'accepted' && !call.connected_at && now - call.accepted_at > 40000)) finish(call, 'ended', 'connection-lost');
    }
  }
  const timer = setInterval(expire, 2000); timer.unref();
  function snapshot(userId, params) {
    expire();
    const call = get("SELECT * FROM voice_calls WHERE caller_id = ? OR callee_id = ? ORDER BY (status IN ('ringing', 'accepted')) DESC, seq DESC LIMIT 1", userId, userId);
    const after = Math.max(0, Number(params.get('after')) || 0);
    const signals = call && call.id === params.get('callId') && active(call)
      ? all('SELECT seq, type, payload FROM voice_signals WHERE call_id = ? AND sender_id != ? AND seq > ? ORDER BY seq LIMIT 256', call.id, userId, after)
        .map((signal) => ({ seq: signal.seq, type: signal.type, payload: JSON.parse(signal.payload) })) : [];
    return { cursor: get('SELECT revision FROM users WHERE id = ?', userId).revision, call: dto(call, userId), signals };
  }
  function ice(userId) {
    const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    const urls = (process.env.ANIMARKET_TURN_URLS || '').split(',').map((value) => value.trim()).filter(Boolean);
    if (urls.length && process.env.ANIMARKET_TURN_SECRET) {
      if (!urls.every((url) => /^turns?:[^\s]+$/.test(url))) throw new ApiError(503, 'The call relay is not configured correctly.');
      const username = `${Math.floor(Date.now() / 1000) + 3600}:${userId}`;
      iceServers.push({ urls, username, credential: createHmac('sha1', process.env.ANIMARKET_TURN_SECRET).update(username).digest('base64') });
    }
    return { iceServers };
  }
  async function handle({ user, req, url, bodyJson, respond }) {
    if (!url.pathname.startsWith('/calls') || url.pathname === '/calls/sync') return false;
    expire();
    if (url.pathname === '/calls/ice' && req.method === 'GET') { respond(200, ice(user.id)); return true; }
    if (url.pathname === '/calls' && req.method === 'POST') {
      const body = await bodyJson(req);
      if (typeof body.conversationId !== 'string' || !body.conversationId || body.conversationId.length > 50) throw new ApiError(400, 'Invalid conversation.');
      if (typeof body.clientId !== 'string' || !/^[\w-]{8,100}$/.test(body.clientId)) throw new ApiError(400, 'Invalid call request.');
      const conversation = get('SELECT c.* FROM conversations c JOIN members m ON c.id = m.conversation_id WHERE c.id = ? AND m.user_id = ?', body.conversationId, user.id);
      if (!conversation) throw new ApiError(404, 'Conversation not found.');
      const existing = get('SELECT * FROM voice_calls WHERE caller_id = ? AND client_id = ?', user.id, body.clientId);
      if (existing) {
        if (existing.conversation_id !== conversation.id) throw new ApiError(409, 'This call request was already used.');
        respond(200, { call: dto(existing, user.id) }); return true;
      }
      const peerId = conversation.initiator_id === user.id ? conversation.recipient_id : conversation.initiator_id;
      if (peerId === user.id) throw new ApiError(400, 'Choose another user to call.');
      const busy = get("SELECT id FROM voice_calls WHERE status IN ('ringing', 'accepted') AND (caller_id IN (?, ?) OR callee_id IN (?, ?))", user.id, peerId, user.id, peerId);
      if (busy) throw new ApiError(409, 'You or this user are already in a call.');
      const id = randomUUID(); const now = Date.now();
      run("INSERT INTO voice_calls (id, conversation_id, caller_id, callee_id, client_id, status, created_at, caller_seen, callee_seen) VALUES (?, ?, ?, ?, ?, 'ringing', ?, ?, ?)", id, conversation.id, user.id, peerId, body.clientId, now, now, now);
      notify([user.id, peerId]); respond(201, { call: dto(authorize(id, user.id), user.id) }); return true;
    }
    const match = url.pathname.match(/^\/calls\/([^/]+)\/(accept|decline|end|heartbeat|connected|signals)$/);
    if (!match || req.method !== 'POST') return false;
    const action = match[2];
    const body = await bodyJson(req, 70000);
    // Re-read after the body arrives; another request may have ended the call meanwhile.
    const call = authorize(match[1], user.id);
    if (action === 'end' || action === 'decline') {
      if (action === 'decline' && user.id !== call.callee_id) throw new ApiError(403, 'Only the recipient can decline a call.');
      if (active(call)) finish(call, action === 'decline' ? 'declined' : 'ended', action === 'decline' ? 'declined' : body.reason === 'connection-lost' ? 'connection-lost' : call.status === 'ringing' ? 'cancelled' : 'hangup');
    } else {
      if (!active(call)) throw new ApiError(409, 'This call has ended.');
      if (action === 'accept') {
        if (user.id !== call.callee_id) throw new ApiError(403, 'Only the recipient can answer a call.');
        if (call.status === 'ringing') { run("UPDATE voice_calls SET status = 'accepted', accepted_at = ?, callee_seen = ? WHERE id = ?", Date.now(), Date.now(), call.id); notify(members(call)); }
      } else if (action === 'heartbeat' || action === 'connected') {
        const prefix = user.id === call.caller_id ? 'caller' : 'callee';
        run(`UPDATE voice_calls SET ${prefix}_seen = ? WHERE id = ?`, Date.now(), call.id);
        if (action === 'connected') {
          if (call.status !== 'accepted') throw new ApiError(409, 'This call has not been answered.');
          run(`UPDATE voice_calls SET ${prefix}_connected = 1 WHERE id = ?`, call.id);
          run('UPDATE voice_calls SET connected_at = ? WHERE id = ? AND connected_at IS NULL AND caller_connected = 1 AND callee_connected = 1', Date.now(), call.id);
          notify(members(call));
        }
      } else if (action === 'signals') {
        const { type, payload, clientId } = body;
        if (!['offer', 'answer', 'ice'].includes(type) || typeof clientId !== 'string' || !/^[\w-]{8,100}$/.test(clientId)) throw new ApiError(400, 'Invalid call signal.');
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ApiError(400, 'Invalid call signal.');
        if (type !== 'ice') {
          if (typeof payload.sdp !== 'string' || payload.sdp.length > 65000 || !payload.sdp.startsWith('v=0') || payload.type !== type || !/m=audio\s/.test(payload.sdp) || /m=video\s/.test(payload.sdp)) throw new ApiError(400, 'Invalid voice description.');
          if ((type === 'offer') !== (user.id === call.caller_id)) throw new ApiError(403, 'Invalid call signaling role.');
          if (type === 'answer' && call.status !== 'accepted') throw new ApiError(409, 'Answer the call first.');
        } else if (typeof payload.candidate !== 'string' || payload.candidate.length > 4096 || (payload.sdpMid != null && (typeof payload.sdpMid !== 'string' || payload.sdpMid.length > 30)) || (payload.sdpMLineIndex != null && (!Number.isInteger(payload.sdpMLineIndex) || payload.sdpMLineIndex < 0 || payload.sdpMLineIndex > 10))) throw new ApiError(400, 'Invalid connection candidate.');
        const encoded = JSON.stringify(type === 'ice' ? { candidate: payload.candidate, sdpMid: payload.sdpMid ?? null, sdpMLineIndex: payload.sdpMLineIndex ?? null } : { type, sdp: payload.sdp });
        const previous = get('SELECT * FROM voice_signals WHERE call_id = ? AND sender_id = ? AND client_id = ?', call.id, user.id, clientId);
        if (previous && (previous.type !== type || previous.payload !== encoded)) throw new ApiError(409, 'This signal request was already used.');
        if (!previous) {
          if (type !== 'ice' && get('SELECT seq FROM voice_signals WHERE call_id = ? AND type = ?', call.id, type)) throw new ApiError(409, 'This voice description was already sent.');
          if (get('SELECT COUNT(*) count FROM voice_signals WHERE call_id = ?', call.id).count >= 256) throw new ApiError(429, 'Too many call signals.');
          run('INSERT INTO voice_signals (call_id, sender_id, client_id, type, payload) VALUES (?, ?, ?, ?, ?)', call.id, user.id, clientId, type, encoded); notify(members(call));
        }
      }
    }
    respond(200, { call: dto(authorize(call.id, user.id), user.id) }); return true;
  }
  return { handle, snapshot, expire, close: () => clearInterval(timer), endForUser(userId) {
    for (const call of all("SELECT * FROM voice_calls WHERE status IN ('ringing', 'accepted') AND (caller_id = ? OR callee_id = ?)", userId, userId)) finish(call, 'ended', 'connection-lost');
  } };
}
module.exports = { createVoiceCalls };
