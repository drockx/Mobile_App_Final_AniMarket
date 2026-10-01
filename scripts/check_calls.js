const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const { createMessagingServer } = require('../server/server');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { createVoiceService } = require('../src/features/calls/application/voice_service.ts');
const person = (name) => ({ fullName: name, email: `${name}@example.test`, password: 'Secure-test-2468', phone: '09123456789', city: 'Tagum City', street: 'Purok 1', barangay: 'Magugpo', postalCode: '8100', acceptedTerms: true });
const sdp = (type) => ({ type, sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' });

function nativeMediaFactory(expoGo, nativeModules = {}) {
  const loaded = [];
  const exports = {};
  const source = fs.readFileSync(require.resolve('../src/features/calls/data/voice_media.native.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'expo') return { isRunningInExpoGo: () => expoGo };
    if (name === 'react-native') return { NativeModules: nativeModules };
    loaded.push(name);
    throw new Error(`Unexpected native module load: ${name}`);
  } });
  return { createMedia: exports.createVoiceMedia, loaded };
}

test('Expo Go can load the call adapter without evaluating unavailable native modules', () => {
  const adapter = nativeMediaFactory(true);
  const service = createVoiceService({}, adapter.createMedia);
  assert.equal(service.getSnapshot().phase, 'idle');
  assert.throws(adapter.createMedia, /Expo Go does not include the call module/);
  assert.deepEqual(adapter.loaded, []);
});

test('development builds use installed call modules; older builds fail safely before importing them', () => {
  const adapter = nativeMediaFactory(false, { WebRTCModule: {}, InCallManager: {} });
  const media = adapter.createMedia();
  assert.equal(media.supportsSpeaker, true);
  media.close();
  assert.deepEqual(adapter.loaded, []);
  for (const modules of [{}, { WebRTCModule: {} }, { InCallManager: {} }]) {
    const oldBuild = nativeMediaFactory(false, modules);
    assert.throws(oldBuild.createMedia, /Rebuild and install/);
    assert.deepEqual(oldBuild.loaded, []);
  }
});
async function start(options = {}) {
  const app = createMessagingServer({ databasePath: ':memory:', pollTimeout: 150, ...options });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  app.url = `http://127.0.0.1:${app.server.address().port}`;
  return app;
}
async function request(app, path, token, body, signal) {
  const response = await fetch(app.url + path, { method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal });
  return { status: response.status, ...await response.json() };
}
function repository(app, token) {
  const call = async (path, body, signal) => { const result = await request(app, path, token, body, signal); if (result.status >= 400) throw new Error(result.error); return result; };
  return {
    sync: (cursor, callId, after, signal) => call(`/calls/sync?callId=${callId}&after=${after}${cursor === null ? '' : `&cursor=${cursor}`}`, null, signal),
    ice: async () => (await call('/calls/ice')).iceServers,
    start: async (conversationId, clientId) => (await call('/calls', { conversationId, clientId })).call,
    action: async (id, action, reason) => (await call(`/calls/${id}/${action}`, { reason })).call,
    signal: async (id, type, payload, clientId) => { await call(`/calls/${id}/signals`, { type, payload, clientId }); },
  };
}
async function until(condition, timeout = 4000) {
  const deadline = Date.now() + timeout;
  while (!condition()) { if (Date.now() > deadline) throw new Error('Timed out waiting for call state'); await new Promise((resolve) => setTimeout(resolve, 10)); }
}
function mediaFactory(state = {}) {
  return () => {
    const peer = { closed: false, muted: false, speakerOn: false, events: null, candidates: [], supportsSpeaker: true,
      async prepare(_servers, events) { peer.events = events; },
      async offer() { peer.events.candidate({ candidate: 'candidate:caller', sdpMid: '0', sdpMLineIndex: 0 }); return sdp('offer'); },
      async answer(value) { assert.equal(value.type, 'offer'); peer.events.candidate({ candidate: 'candidate:callee', sdpMid: '0', sdpMLineIndex: 0 }); return sdp('answer'); },
      async applyAnswer(value) { assert.equal(value.type, 'answer'); },
      async addCandidate(value) { peer.candidates.push(value); peer.events.connection('connected'); },
      mute(value) { peer.muted = value; }, speaker(value) { peer.speakerOn = value; }, close() { peer.closed = true; },
    }; state.peer = peer; return peer;
  };
}

test('authenticated real accounts can ring, answer, exchange private signals, and save a call summary', async (t) => {
  const app = await start(); t.after(() => app.close());
  const caller = await request(app, '/auth/register', null, person('Caller'));
  const callee = await request(app, '/auth/register', null, person('Callee'));
  const other = await request(app, '/auth/register', null, person('Other'));
  const conversation = (await request(app, '/conversations', caller.token, { recipientId: callee.account.id })).conversation;
  const began = await request(app, '/calls', caller.token, { conversationId: conversation.id, clientId: 'call-request-001' });
  const id = began.call.id; assert.equal(began.status, 201); assert.equal(began.call.peer.name, 'Callee');
  await t.test('creation is idempotent, participants are busy, and outsiders cannot access calls', async () => {
    assert.equal((await request(app, '/calls', caller.token, { conversationId: conversation.id, clientId: 'call-request-001' })).call.id, id);
    assert.equal((await request(app, '/calls', callee.token, { conversationId: conversation.id, clientId: 'reverse-request-002' })).status, 409);
    assert.equal((await request(app, '/calls', other.token, { conversationId: conversation.id, clientId: 'intrusion-request' })).status, 404);
    for (const action of ['accept', 'end', 'signals', 'heartbeat']) assert.equal((await request(app, `/calls/${id}/${action}`, other.token, {})).status, 404);
    assert.equal((await request(app, '/calls/sync', other.token)).call, null);
    assert.equal((await request(app, '/calls/ice')).status, 401);
    assert.equal((await request(app, `/calls/${id}/accept`, caller.token, {})).status, 403);
  });
  await t.test('ringing wakes the recipient, and only the callee can answer', async () => {
    const sync = await request(app, '/calls/sync', callee.token);
    assert.equal(sync.call.callerId, caller.account.id); assert.equal(sync.call.peer.name, 'Caller');
    const waiting = request(app, `/calls/sync?cursor=${sync.cursor}&callId=${id}&after=0`, caller.token);
    assert.equal((await request(app, `/calls/${id}/accept`, callee.token, {})).call.status, 'accepted');
    assert.equal((await waiting).call.status, 'accepted');
  });
  await t.test('SDP and ICE are private, validated, and retries cannot duplicate them', async () => {
    assert.equal((await request(app, `/calls/${id}/signals`, callee.token, { type: 'offer', payload: sdp('offer'), clientId: 'invalid-role-001' })).status, 403);
    assert.equal((await request(app, `/calls/${id}/signals`, caller.token, { type: 'offer', payload: { type: 'offer', sdp: 'v=0\nm=video 9 UDP/TLS/RTP/SAVPF 111' }, clientId: 'invalid-video-001' })).status, 400);
    const signal = { type: 'offer', payload: sdp('offer'), clientId: 'offer-request-001' };
    assert.equal((await request(app, `/calls/${id}/signals`, caller.token, signal)).status, 200);
    assert.equal((await request(app, `/calls/${id}/signals`, caller.token, signal)).status, 200);
    const incoming = await request(app, `/calls/sync?callId=${id}&after=0`, callee.token);
    assert.equal(incoming.signals.length, 1); assert.deepEqual(incoming.signals[0].payload, sdp('offer'));
    assert.equal((await request(app, `/calls/sync?callId=${id}&after=0`, caller.token)).signals.length, 0);
    assert.equal((await request(app, `/calls/${id}/signals`, caller.token, { ...signal, clientId: 'second-offer-002' })).status, 409);
  });
  await t.test('duration starts only after both audio connections are confirmed; hangup cleans signals', async () => {
    assert.equal((await request(app, `/calls/${id}/connected`, caller.token, {})).call.connectedAt, null);
    assert.ok((await request(app, `/calls/${id}/connected`, callee.token, {})).call.connectedAt);
    assert.equal((await request(app, `/calls/${id}/end`, caller.token, {})).call.status, 'ended');
    const duplicate = await request(app, `/calls/${id}/end`, callee.token, {}); assert.equal(duplicate.call.status, 'ended');
    assert.equal(app.db.prepare('SELECT COUNT(*) count FROM voice_signals').get().count, 0);
    const history = await request(app, `/conversations/${conversation.id}/messages`, callee.token);
    assert.equal(history.messages.length, 1); assert.match(history.messages[0].text, /^Voice call · /);
    assert.equal((await request(app, `/calls/${id}/heartbeat`, caller.token, {})).status, 409);
  });
});

test('two app call services negotiate live, mute, route audio, hang up, and clear on sign out', async (t) => {
  const app = await start(); t.after(() => app.close());
  const alice = await request(app, '/auth/register', null, person('Alice'));
  const bob = await request(app, '/auth/register', null, person('Bob'));
  const conversation = (await request(app, '/conversations', alice.token, { recipientId: bob.account.id })).conversation;
  const aliceMedia = {}; const bobMedia = {};
  const a = createVoiceService(repository(app, alice.token), mediaFactory(aliceMedia));
  const b = createVoiceService(repository(app, bob.token), mediaFactory(bobMedia));
  a.connect(alice.account.id, alice.token); b.connect(bob.account.id, bob.token);
  t.after(() => { a.connect('', ''); b.connect('', ''); });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(a.getSnapshot().phase, 'idle'); assert.equal(a.getSnapshot().error, '');
  assert.equal(b.getSnapshot().error, '', 'an empty call inbox must not produce a connection error');
  await a.start(conversation.id); await until(() => b.getSnapshot().phase === 'incoming');
  assert.equal(bobMedia.peer, undefined, 'ringing must not open the microphone');
  await b.accept(); await until(() => a.getSnapshot().phase === 'connected' && b.getSnapshot().phase === 'connected');
  assert.ok(a.getSnapshot().connectedAt); assert.ok(bobMedia.peer.candidates.length);
  a.toggleMute(); assert.equal(aliceMedia.peer.muted, true); a.toggleMute(); assert.equal(aliceMedia.peer.muted, false);
  a.toggleSpeaker(); assert.equal(aliceMedia.peer.speakerOn, true);
  await a.end(); await until(() => b.getSnapshot().phase === 'ended');
  assert.equal(aliceMedia.peer.closed, true); assert.equal(bobMedia.peer.closed, true);
  a.dismiss(); assert.equal(a.getSnapshot().call, null); b.connect('', ''); assert.equal(b.getSnapshot().phase, 'idle');
});

test('declines and unanswered calls release busy participants; logout closes an active call', async (t) => {
  const app = await start({ ringTimeout: 30 }); t.after(() => app.close());
  const a = await request(app, '/auth/register', null, person('Alice'));
  const b = await request(app, '/auth/register', null, person('Bob'));
  const conversation = (await request(app, '/conversations', a.token, { recipientId: b.account.id })).conversation;
  let call = (await request(app, '/calls', a.token, { conversationId: conversation.id, clientId: 'decline-call-001' })).call;
  assert.equal((await request(app, `/calls/${call.id}/decline`, b.token, {})).call.status, 'declined');
  call = (await request(app, '/calls', a.token, { conversationId: conversation.id, clientId: 'unanswered-call-002' })).call;
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal((await request(app, '/calls/sync', a.token)).call.status, 'missed');
  call = (await request(app, '/calls', a.token, { conversationId: conversation.id, clientId: 'logout-call-003' })).call;
  await request(app, '/auth/logout', a.token, {});
  assert.equal((await request(app, '/calls/sync', b.token)).call.status, 'ended');
});

test('a denied microphone creates no call, and a delayed microphone is closed after account switch', async () => {
  let starts = 0;
  const repo = { ice: async () => [], start: async () => { starts++; }, sync: (_cursor, _id, _after, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })) };
  const denied = createVoiceService(repo, () => ({ prepare: async () => { throw new Error('Microphone permission denied'); }, close() {} }));
  denied.connect('A', 'token-A'); await assert.rejects(denied.start('conversation'), /permission/); assert.equal(starts, 0); denied.connect('', '');
  let release; let stopped = false;
  const delayed = createVoiceService(repo, () => ({ prepare: () => new Promise((resolve) => { release = resolve; }), close() { stopped = true; } }));
  delayed.connect('A', 'token-A'); const pending = delayed.start('conversation'); await until(() => !!release);
  delayed.connect('B', 'token-B'); release(); await assert.rejects(pending, /cancelled/); assert.equal(stopped, true);
  assert.equal(delayed.getSnapshot().call, null); assert.equal(starts, 0); delayed.connect('', '');
});

test('lost creation acknowledgement retries one call, and cancelling a delayed request ends it', async (t) => {
  const app = await start(); t.after(() => app.close());
  const a = await request(app, '/auth/register', null, person('Alice'));
  const b = await request(app, '/auth/register', null, person('Bob'));
  const conversation = (await request(app, '/conversations', a.token, { recipientId: b.account.id })).conversation;
  const base = repository(app, a.token); let attempts = 0;
  const service = createVoiceService({ ...base, async start(...args) { const call = await base.start(...args); if (++attempts === 1) throw new Error('Acknowledgement lost'); return call; } }, mediaFactory());
  service.connect(a.account.id, a.token); t.after(() => service.connect('', ''));
  await service.start(conversation.id);
  assert.equal(attempts, 2); assert.equal(app.db.prepare('SELECT COUNT(*) count FROM voice_calls').get().count, 1);
  await service.end(); service.dismiss();
  let release; let created;
  const delayed = createVoiceService({ ...base, async start(...args) { created = await base.start(...args); await new Promise((resolve) => { release = resolve; }); return created; } }, mediaFactory());
  delayed.connect(a.account.id, a.token); t.after(() => delayed.connect('', ''));
  const pending = delayed.start(conversation.id); await until(() => !!release);
  await delayed.end(); release(); await pending;
  assert.equal(app.db.prepare('SELECT status FROM voice_calls WHERE id = ?').get(created.id).status, 'ended');
  assert.equal(delayed.getSnapshot().phase, 'idle');
});

test('leaving the app stops an active microphone and informs the other user', async (t) => {
  const app = await start(); t.after(() => app.close());
  const a = await request(app, '/auth/register', null, person('Alice'));
  const b = await request(app, '/auth/register', null, person('Bob'));
  const conversation = (await request(app, '/conversations', a.token, { recipientId: b.account.id })).conversation;
  const state = {}; const service = createVoiceService(repository(app, a.token), mediaFactory(state));
  service.connect(a.account.id, a.token); t.after(() => service.connect('', ''));
  await service.start(conversation.id); const id = service.getSnapshot().call.id;
  service.setActive(false); assert.equal(state.peer.closed, true);
  await until(() => app.db.prepare('SELECT status FROM voice_calls WHERE id = ?').get(id).status === 'ended');
  assert.equal((await request(app, '/calls/sync', b.token)).call.reason, 'connection-lost');
});
