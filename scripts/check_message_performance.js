const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { createMessageService } = require('../src/features/messages/application/message_service.ts');
const { createLiveSync } = require('../src/services/live_sync.ts');
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const message = (seq) => ({ id: `message-${seq}`, seq, conversationId: 'chat', senderId: 'bob', clientId: `client-${seq}`, text: `Message ${seq}`, createdAt: '2026-10-04T04:00:00Z' });
const page = (first, last, hasMore = false) => ({ messages: Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => message(first + index)), hasMore });
const conversation = (seq, extra = {}) => ({ id: 'chat', side: 'buying', participant: 'Bob', initials: 'B', participantId: 'bob', listing: 'Direct conversation', preview: '', time: '', unreadCount: seq, verifiedSeller: false, lastMessageSeq: seq, readSeq: 0, otherReadSeq: 0, updatedAt: '2026-10-04T04:00:00Z', ...extra });
function fixture(t, realtime = true) {
  const live = createLiveSync([]);
  const requests = [];
  const streams = [];
  const repository = {
    sync: async (cursor, signal) => { const update = await live.wait(cursor, signal); return { cursor: update.cursor, conversations: update.value }; },
    messages: async (id, options) => { requests.push({ id, ...options }); return page(1, 1); },
    send: async (_id, _text, clientId) => ({ ...message(2), senderId: 'alice', clientId }),
    read: async () => {},
    open: async () => conversation(0),
    search: async () => [],
  };
  if (realtime) repository.watchMessages = (id, receive, fail) => {
    const stream = { id, receive, fail, stopped: false };
    streams.push(stream);
    return () => { stream.stopped = true; };
  };
  const service = createMessageService(repository);
  service.connect('alice', 'alice-token');
  service.watch('chat');
  t.after(() => service.connect('', ''));
  return { live, requests, streams, repository, service, thread: () => service.getSnapshot().threads.chat };
}

test('incoming realtime messages render immediately without a history fetch; receipts do not refetch', async (t) => {
  const f = fixture(t);
  f.streams[0].receive(page(1, 1));
  const first = f.thread().messages[0];
  f.streams[0].receive(page(1, 2));
  assert.equal(f.thread().messages[1].text, 'Message 2');
  assert.equal(f.thread().syncedThrough, 2);
  assert.equal(f.thread().messages[0], first);
  assert.equal(f.requests.length, 0);
  const unchanged = f.service.getSnapshot();
  f.streams[0].receive(page(1, 2));
  assert.equal(f.service.getSnapshot(), unchanged);
  f.live.update([conversation(2, { otherReadSeq: 2 })]);
  await tick();
  assert.equal(f.service.get('chat').otherReadSeq, 2);
  assert.equal(f.requests.length, 0);
});

test('a send acknowledgement does not skip unseen incoming realtime messages', async (t) => {
  const f = fixture(t);
  f.streams[0].receive(page(1, 1));
  f.repository.send = async () => ({ ...message(3), senderId: 'alice' });
  await f.service.send('chat', 'Reply', 'reply');
  assert.equal(f.thread().syncedThrough, 1);
  f.streams[0].receive(page(1, 3));
  assert.deepEqual(f.thread().messages.map((item) => item.seq), [1, 2, 3]);
  assert.equal(f.thread().syncedThrough, 3);
});

test('reconnecting after more than one page fills every missing message before advancing the cursor', async (t) => {
  const f = fixture(t);
  f.streams[0].receive(page(1, 10));
  f.repository.messages = async (id, options) => {
    f.requests.push({ id, ...options });
    const last = Math.min(options.after + 50, 120);
    return page(options.after + 1, last, last < 120);
  };
  f.streams[0].receive(page(71, 120, true));
  assert.equal(f.thread().syncedThrough, 10);
  await tick();
  assert.deepEqual(f.requests.map((request) => request.after), [10, 60, 110]);
  assert.deepEqual(f.thread().messages.map((item) => item.seq), Array.from({ length: 120 }, (_, index) => index + 1));
  assert.equal(f.thread().syncedThrough, 120);
});

test('receiving a message during an older-history request never moves the live cursor backwards', async (t) => {
  const f = fixture(t);
  f.streams[0].receive(page(101, 150, true));
  const history = deferred();
  f.repository.messages = async () => history.promise;
  const loading = f.service.loadOlder('chat');
  f.streams[0].receive(page(102, 151, true));
  history.resolve(page(51, 100, true));
  await loading;
  assert.equal(f.thread().syncedThrough, 151);
  assert.equal(f.thread().messages[0].seq, 51);
  assert.equal(f.thread().messages.at(-1).seq, 151);
  assert.equal(f.thread().hasMore, true);
});

test('listeners stop on background, navigation and account switch; late callbacks are ignored', async (t) => {
  const f = fixture(t);
  f.streams[0].receive(page(1, 1));
  f.service.setActive(false);
  assert.equal(f.streams[0].stopped, true);
  f.streams[0].receive(page(1, 2));
  assert.equal(f.thread().syncedThrough, 1);
  f.service.setActive(true);
  assert.equal(f.streams.length, 2);
  f.streams[1].receive(page(1, 2));
  const unwatch = f.service.watch('other-chat');
  assert.equal(f.streams[1].stopped, true);
  f.streams[1].receive(page(1, 3));
  assert.equal(f.thread().syncedThrough, 2);
  unwatch();
  assert.equal(f.streams[2].stopped, true);
  f.service.watch('chat');
  f.service.connect('charlie', 'charlie-token');
  assert.equal(f.streams[3].stopped, true);
  f.streams[3].receive(page(1, 4));
  assert.deepEqual(f.service.getSnapshot().threads, {});
});

test('a failed realtime listener can be retried without accepting events from the old listener', async (t) => {
  const f = fixture(t);
  f.streams[0].fail(new Error('Temporary connection error'));
  assert.equal(f.thread().error, 'Temporary connection error');
  await f.service.reload('chat');
  assert.equal(f.streams[0].stopped, true);
  f.streams[1].receive(page(1, 1));
  f.streams[0].fail(new Error('Old error'));
  assert.equal(f.thread().error, '');
  assert.equal(f.thread().syncedThrough, 1);
});

test('slow history loading does not block conversation updates and catches updates arriving during the request', async (t) => {
  const f = fixture(t, false);
  await tick();
  const pending = deferred();
  f.repository.messages = async (id, options) => { f.requests.push({ id, ...options }); return options.after === 1 ? pending.promise : page(3, 3); };
  f.live.update([conversation(2)]);
  await tick();
  f.live.update([conversation(3, { otherReadSeq: 1 })]);
  await tick();
  assert.equal(f.service.get('chat').lastMessageSeq, 3);
  assert.equal(f.service.get('chat').otherReadSeq, 1);
  pending.resolve(page(2, 2));
  await tick();
  assert.equal(f.thread().syncedThrough, 3);
  assert.deepEqual(f.thread().messages.map((item) => item.seq), [1, 2, 3]);
  const reads = f.requests.length;
  f.live.update([conversation(3, { otherReadSeq: 3 })]);
  await tick();
  assert.equal(f.requests.length, reads);
});

test('an empty history response cannot cause an unbounded fetch loop', async (t) => {
  const f = fixture(t, false);
  await tick();
  f.repository.messages = async (id, options) => { f.requests.push({ id, ...options }); return page(1, 0); };
  f.live.update([conversation(5)]);
  await tick();
  const count = f.requests.length;
  await tick();
  assert.equal(f.requests.length, count);
});

test('outgoing messages appear synchronously; rapid sends keep their order and deduplicate retries', async (t) => {
  const f = fixture(t);
  const first = deferred(), second = deferred();
  const requests = [];
  f.repository.send = (id, text, clientId) => {
    requests.push({ id, text, clientId });
    return requests.length === 1 ? first.promise : second.promise;
  };
  const one = f.service.send('chat', 'First', 'first');
  const repeated = f.service.send('chat', 'First', 'first');
  const two = f.service.send('chat', 'Second', 'second');
  assert.deepEqual(f.thread().pending.map((item) => [item.text, item.delivery]), [['First', 'sending'], ['Second', 'sending']]);
  assert.equal(f.thread().messages.length, 0);
  assert.equal(f.thread().syncedThrough, 0);
  await assert.rejects(f.service.send('chat', 'Changed text', 'first'), /already used/);
  await tick();
  assert.deepEqual(requests.map((item) => item.clientId), ['first']);
  const ack = { ...message(1), senderId: 'alice', text: 'First', clientId: 'first' };
  first.resolve(ack);
  assert.deepEqual(await one, ack);
  assert.deepEqual(await repeated, ack);
  await tick();
  assert.deepEqual(requests.map((item) => item.clientId), ['first', 'second']);
  assert.equal(f.thread().pending.length, 1);
  second.resolve({ ...message(2), senderId: 'alice', text: 'Second', clientId: 'second' });
  await two;
  assert.deepEqual(f.thread().messages.map((item) => item.text), ['First', 'Second']);
  assert.equal(f.thread().pending.length, 0);
  await f.service.send('chat', 'First', 'first');
  assert.equal(requests.length, 2);
});

test('a failed send stays in its bubble and retries with the original request ID', async (t) => {
  const f = fixture(t);
  const requests = [];
  f.repository.send = async (id, text, clientId) => {
    requests.push({ id, text, clientId });
    if (requests.length === 1) throw new Error('Connection lost');
    return { ...message(1), senderId: 'alice', text, clientId };
  };
  await assert.rejects(f.service.send('chat', 'Keep me', 'retry-id'), /Connection lost/);
  assert.equal(f.thread().pending[0].text, 'Keep me');
  assert.equal(f.thread().pending[0].delivery, 'failed');
  assert.equal(f.thread().pending[0].error, 'Connection lost');
  const createdAt = f.thread().pending[0].createdAt;
  const retry = f.service.send('chat', 'Keep me', 'retry-id');
  assert.equal(f.thread().pending[0].delivery, 'sending');
  assert.equal(f.thread().pending[0].createdAt, createdAt);
  await retry;
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(f.thread().pending.length, 0);
  assert.equal(f.thread().messages.length, 1);
});

test('live confirmation releases the next send even when HTTP is slow; a late error cannot mark it failed', async (t) => {
  const f = fixture(t);
  const slowHttp = deferred();
  const requests = [];
  f.repository.send = (id, text, clientId) => {
    requests.push(clientId);
    return requests.length === 1 ? slowHttp.promise : Promise.resolve({ ...message(3), senderId: 'alice', text, clientId });
  };
  const one = f.service.send('chat', 'First', 'first');
  const two = f.service.send('chat', 'Second', 'second');
  await tick();
  // Another participant can use the same client ID without confirming our send.
  f.streams[0].receive({ messages: [{ ...message(1), clientId: 'first' }], hasMore: false });
  assert.equal(f.thread().pending.length, 2);
  assert.equal(requests.length, 1);
  f.streams[0].receive({ messages: [{ ...message(2), senderId: 'alice', text: 'First', clientId: 'first' }], hasMore: false });
  await one; await two;
  assert.deepEqual(requests, ['first', 'second']);
  assert.equal(f.thread().pending.length, 0);
  slowHttp.reject(new Error('HTTP response lost after delivery'));
  await tick();
  assert.equal(f.thread().pending.length, 0);
  assert.equal(f.thread().messages.filter((item) => item.clientId === 'first' && item.senderId === 'alice').length, 1);
});

test('backgrounding and reconnecting do not discard a valid in-flight send confirmation', async (t) => {
  const f = fixture(t);
  const request = deferred();
  f.repository.send = () => request.promise;
  const sending = f.service.send('chat', 'Still sending', 'foreground');
  await tick();
  f.service.setActive(false); f.service.setActive(true); f.service.reconnect();
  assert.equal(f.thread().pending.length, 1);
  request.resolve({ ...message(1), senderId: 'alice', text: 'Still sending', clientId: 'foreground' });
  await sending;
  assert.equal(f.thread().pending.length, 0);
  assert.equal(f.thread().messages[0].text, 'Still sending');
});

test('account switch clears pending messages, ignores old acknowledgements and cancels queued sends', async (t) => {
  const f = fixture(t);
  const request = deferred();
  let requests = 0;
  f.repository.send = () => { requests++; return request.promise; };
  const one = assert.rejects(f.service.send('chat', 'First', 'first'), /account changed/);
  const two = assert.rejects(f.service.send('chat', 'Second', 'second'), /account changed/);
  await tick();
  assert.equal(requests, 1);
  f.service.connect('charlie', 'charlie-token');
  request.resolve({ ...message(1), senderId: 'alice', text: 'First', clientId: 'first' });
  await one; await two;
  assert.equal(requests, 1);
  assert.deepEqual(f.service.getSnapshot().threads, {});
});

test('unchanged inbox updates preserve rows and skip rendering; receipts update only their row', async (t) => {
  const f = fixture(t);
  f.live.update([conversation(1), { ...conversation(1), id: 'second-chat' }]);
  await tick();
  const snapshot = f.service.getSnapshot();
  f.live.update([conversation(1), { ...conversation(1), id: 'second-chat' }]);
  await tick();
  assert.equal(f.service.getSnapshot(), snapshot);
  f.live.update([conversation(1, { otherReadSeq: 1 }), { ...conversation(1), id: 'second-chat' }]);
  await tick();
  assert.notEqual(f.service.getSnapshot().conversations[0], snapshot.conversations[0]);
  assert.equal(f.service.getSnapshot().conversations[1], snapshot.conversations[1]);
});

test('failed message listeners retry automatically and stop retries when backgrounded', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t);
  f.streams[0].fail(new Error('Listener ended'));
  t.mock.timers.tick(1000);
  assert.equal(f.streams[0].stopped, true);
  assert.equal(f.streams.length, 2);
  f.streams[1].receive(page(1, 1));
  assert.equal(f.thread().error, '');
  f.streams[1].fail(new Error('Listener ended again'));
  f.service.setActive(false);
  t.mock.timers.tick(15000);
  assert.equal(f.streams.length, 2);
  f.service.setActive(true);
  assert.equal(f.streams.length, 3);
});

test('the Firebase inbox attaches a fresh listener after a terminal error and rejects stale account callbacks', async () => {
  const path = require('node:path');
  const Module = require('node:module');
  const filename = path.resolve(__dirname, '../src/features/messages/data/firebase_message_repository.ts');
  const isolated = new Module(filename, module);
  const streams = [];
  let authChanged;
  const services = { auth: { currentUser: { uid: 'alice' } }, firestore: {} };
  const imports = {
    'firebase/auth': { onAuthStateChanged: (_auth, callback) => { authChanged = callback; } },
    'firebase/firestore': {
      collection: (...parts) => parts, where: (...parts) => parts, query: (...parts) => parts,
      onSnapshot: (_query, receive, fail) => { const stream = { receive, fail, stopped: false }; streams.push(stream); return () => { stream.stopped = true; }; },
    },
    '@/services/firebase': { getFirebaseServices: () => services },
    '@/services/firebase_identity': { requireFirebaseUser: () => services.auth.currentUser },
    '@/services/supabase': {},
    '@/services/live_sync': { createLiveSync },
  };
  isolated.require = (id) => { assert.ok(id in imports, `Unexpected dependency ${id}`); return imports[id]; };
  isolated._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const { firebaseMessageRepository: repository } = isolated.exports;
  const controller = new AbortController();
  try {
    const first = repository.sync(null, controller.signal);
    streams[0].receive({ docs: [] });
    const initial = await first;
    const failed = repository.sync(initial.cursor, controller.signal);
    streams[0].fail(new Error('Listener terminated'));
    await assert.rejects(failed, /Listener terminated/);
    const retry = repository.sync(null, controller.signal);
    assert.equal(streams.length, 2);
    streams[0].fail(new Error('Stale error'));
    streams[1].receive({ docs: [] });
    await retry;
    services.auth.currentUser = { uid: 'bob' };
    authChanged(services.auth.currentUser);
    assert.equal(streams[1].stopped, true);
    let settled = false;
    const nextAccount = repository.sync(null, controller.signal).then((value) => { settled = true; return value; });
    streams[1].receive({ docs: [{ data: () => { throw new Error('Old account callback accepted'); } }] });
    streams[1].fail(new Error('Old account error'));
    await tick();
    assert.equal(settled, false);
    streams[2].receive({ docs: [] });
    await nextAccount;
  } finally { controller.abort(); services.auth.currentUser = null; authChanged(null); }
});

test('interrupted read receipts retry on foreground without marking background messages as read', async (t) => {
  const f = fixture(t);
  const first = deferred(), second = deferred();
  let requests = 0;
  f.repository.read = () => ++requests === 1 ? first.promise : second.promise;
  const interrupted = f.service.markRead('chat', 1);
  f.service.setActive(false);
  await f.service.markRead('chat', 1);
  assert.equal(requests, 1);
  f.service.setActive(true);
  const retry = f.service.markRead('chat', 1);
  assert.equal(requests, 2);
  first.reject(new Error('Lost connection while backgrounded'));
  await interrupted;
  await f.service.markRead('chat', 1);
  assert.equal(requests, 2);
  second.resolve(); await retry;
  f.live.update([conversation(1, { readSeq: 1 })]); await tick();
  await f.service.markRead('chat', 1);
  assert.equal(requests, 2);
});
