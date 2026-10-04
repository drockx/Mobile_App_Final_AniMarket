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
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
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
