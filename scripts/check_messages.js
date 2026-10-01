const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createMessagingServer } = require('../server/server');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  module._compile(outputText, filename);
};
const { createMessageService } = require('../src/features/messages/application/message_service.ts');
const person = (name, email) => ({ fullName: name, email, password: 'Secure-test-2468', phone: '09123456789', city: 'Tagum City', street: 'Purok 1', barangay: 'Magugpo', postalCode: '8100', acceptedTerms: true });
async function start(databasePath = ':memory:') {
  const app = createMessagingServer({ databasePath, pollTimeout: 5000 });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  return { ...app, url: `http://127.0.0.1:${app.server.address().port}` };
}
async function request(app, pathname, token, body, method = body ? 'POST' : 'GET', signal) {
  const response = await fetch(app.url + pathname, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal });
  return { status: response.status, ...(await response.json()) };
}
function repository(app, token) {
  const call = async (pathname, body, signal) => { const result = await request(app, pathname, token, body, undefined, signal); if (result.status >= 400) throw new Error(result.error); return result; };
  return {
    sync: (cursor, signal) => call(`/sync${cursor === null ? '' : `?cursor=${cursor}`}`, undefined, signal),
    messages: (id, page) => call(`/conversations/${id}/messages?${page.before ? `before=${page.before}` : page.after !== undefined ? `after=${page.after}` : ''}`),
    open: async (recipientId) => (await call('/conversations', { recipientId })).conversation,
    search: async (query, signal) => (await call(`/users?q=${encodeURIComponent(query)}`, undefined, signal)).users,
    send: async (id, text, clientId) => (await call(`/conversations/${id}/messages`, { text, clientId })).message,
    read: async (id, throughSeq) => { await call(`/conversations/${id}/read`, { throughSeq }); },
  };
}
async function until(condition, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (!condition()) { if (Date.now() > deadline) throw new Error('Timed out waiting for live message delivery'); await new Promise((resolve) => setTimeout(resolve, 10)); }
}

test('real accounts, private conversations and live two-way delivery', async (t) => {
  const app = await start(); t.after(() => app.close());
  const alice = await request(app, '/auth/register', null, person('Alice Buyer', 'alice@example.test'));
  const bob = await request(app, '/auth/register', null, person('Bob Seller', 'bob@example.test'));
  const stranger = await request(app, '/auth/register', null, person('Other User', 'other@example.test'));
  assert.equal(alice.status, 201); assert.equal(bob.status, 201); assert.equal(stranger.status, 201);
  let conversation;
  await t.test('authentication rejects incorrect passwords, duplicate emails and unauthenticated requests', async () => {
    assert.equal((await request(app, '/auth/login', null, { email: 'ALICE@example.test', password: 'wrong' })).status, 401);
    assert.equal((await request(app, '/auth/login', null, { email: 'ALICE@example.test', password: 'Secure-test-2468' })).status, 200);
    assert.equal((await request(app, '/auth/register', null, person('Duplicate', 'ALICE@example.test'))).status, 409);
    assert.equal((await request(app, '/sync')).status, 401);
    assert.equal((await request(app, '/auth/register', null, { ...person('Invalid', 'invalid@example.test'), city: 'Davao City' })).status, 400);
    const hash = app.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(alice.account.id).password_hash;
    assert.notEqual(hash, 'Secure-test-2468'); assert.equal(hash.length, 128);
  });
  await t.test('user lookup excludes self and does not disclose email, phone or address', async () => {
    const result = await request(app, '/users?q=Bob', alice.token);
    assert.deepEqual(result.users, [{ id: bob.account.id, fullName: 'Bob Seller', city: 'Tagum City' }]);
    assert.equal((await request(app, '/users?q=Alice', alice.token)).users.length, 0);
    assert.equal((await request(app, '/users?q=bob%40example.test', alice.token)).users[0].id, bob.account.id);
    assert.equal((await request(app, '/users?q=%25', alice.token)).users.length, 0);
    assert.equal((await request(app, '/users?q=Bo_', alice.token)).users.length, 0);
  });
  await t.test('conversations use real account IDs and are reused from either participant', async () => {
    conversation = (await request(app, '/conversations', alice.token, { recipientId: bob.account.id })).conversation;
    assert.equal(conversation.participant, 'Bob Seller'); assert.equal(conversation.side, 'buying');
    const reverse = (await request(app, '/conversations', bob.token, { recipientId: alice.account.id })).conversation;
    assert.equal(reverse.id, conversation.id); assert.equal(reverse.side, 'selling');
    assert.equal((await request(app, '/conversations', alice.token, { recipientId: alice.account.id })).status, 400);
    assert.equal((await request(app, '/conversations', alice.token, { recipientId: 'fake-seller' })).status, 404);
    assert.equal((await request(app, '/conversations', alice.token, { recipientId: bob.account.id, listingId: 'brahman', listingTitle: 'Fake owned listing' })).status, 400);
  });
  await t.test('incoming message wakes the recipient immediately, with unread count and read receipt', async () => {
    const snapshot = await request(app, '/sync', bob.token);
    const began = Date.now();
    const update = request(app, `/sync?cursor=${snapshot.cursor}`, bob.token);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const sent = await request(app, `/conversations/${conversation.id}/messages`, alice.token, { text: 'Hello Bob!\nIs the cow available? 🐄', clientId: 'first-message' });
    assert.equal(sent.status, 201);
    const received = await update;
    assert.ok(Date.now() - began < 2000); assert.equal(received.conversations[0].unreadCount, 1);
    const history = await request(app, `/conversations/${conversation.id}/messages`, bob.token);
    assert.equal(history.messages[0].text, sent.message.text);
    await request(app, `/conversations/${conversation.id}/read`, bob.token, { throughSeq: sent.message.seq });
    assert.equal((await request(app, '/sync', bob.token)).conversations[0].unreadCount, 0);
    assert.equal((await request(app, '/sync', alice.token)).conversations[0].otherReadSeq, sent.message.seq);
  });
  await t.test('retrying the same send does not duplicate messages', async () => {
    const retry = await request(app, `/conversations/${conversation.id}/messages`, alice.token, { text: 'Hello Bob!\nIs the cow available? 🐄', clientId: 'first-message' });
    assert.equal(retry.status, 200);
    assert.equal((await request(app, `/conversations/${conversation.id}/messages`, bob.token)).messages.length, 1);
    assert.equal((await request(app, `/conversations/${conversation.id}/messages`, alice.token, { text: 'Different content', clientId: 'first-message' })).status, 409);
  });
  await t.test('another user cannot read, send, mark read or see private conversations', async () => {
    assert.equal((await request(app, `/conversations/${conversation.id}/messages`, stranger.token)).status, 404);
    assert.equal((await request(app, `/conversations/${conversation.id}/messages`, stranger.token, { text: 'Intrusion', clientId: 'intrusion' })).status, 404);
    assert.equal((await request(app, `/conversations/${conversation.id}/read`, stranger.token, { throughSeq: 999 })).status, 404);
    assert.equal((await request(app, '/sync', stranger.token)).conversations.length, 0);
    assert.equal((await request(app, `/conversations/${conversation.id}/messages`, bob.token, { text: ' '.repeat(20), clientId: 'empty' })).status, 400);
    assert.equal((await request(app, `/conversations/${conversation.id}/messages`, bob.token, { text: 'a'.repeat(2001), clientId: 'long' })).status, 400);
  });
  await t.test('the app message service receives replies live and clears history on account switch', async () => {
    const buyerService = createMessageService(repository(app, alice.token));
    const sellerService = createMessageService(repository(app, bob.token));
    buyerService.connect(alice.account.id, alice.token); sellerService.connect(bob.account.id, bob.token);
    const stopBuyer = buyerService.watch(conversation.id); const stopSeller = sellerService.watch(conversation.id);
    try {
      await until(() => buyerService.getSnapshot().status === 'live' && sellerService.getSnapshot().threads[conversation.id]?.messages.length === 1);
      await sellerService.send(conversation.id, 'Yes, available!', 'live-reply');
      await until(() => buyerService.getSnapshot().threads[conversation.id]?.messages.some((message) => message.text === 'Yes, available!'));
      assert.equal(buyerService.badgeCount('buying'), 1);
      const message = buyerService.getSnapshot().threads[conversation.id].messages.at(-1);
      await buyerService.markRead(conversation.id, message.seq);
      await until(() => sellerService.get(conversation.id)?.otherReadSeq === message.seq);
      buyerService.setActive(false);
      await sellerService.send(conversation.id, 'A reply while your app is away', 'away-reply');
      buyerService.setActive(true);
      await until(() => buyerService.getSnapshot().threads[conversation.id]?.messages.some((item) => item.clientId === 'away-reply'));
      await assert.rejects(() => buyerService.openBuyerConversation({ id: 'demo', title: 'Demo', seller: 'Juan Dela Cruz' }), /sample seller/);
      buyerService.connect('', '');
      assert.equal(buyerService.getSnapshot().conversations.length, 0); assert.deepEqual(buyerService.getSnapshot().threads, {});
      await assert.rejects(() => buyerService.send(conversation.id, 'No longer signed in', 'signed-out'), /sign in/);
    } finally { stopBuyer(); stopSeller(); buyerService.connect('', ''); sellerService.connect('', ''); }
  });
  await t.test('history paginates without dropping messages', async () => {
    for (let index = 0; index < 65; index++) await request(app, `/conversations/${conversation.id}/messages`, alice.token, { text: `Message ${index}`, clientId: `page-${index}` });
    const recent = await request(app, `/conversations/${conversation.id}/messages`, bob.token);
    assert.equal(recent.messages.length, 60); assert.equal(recent.hasMore, true);
    const older = await request(app, `/conversations/${conversation.id}/messages?before=${recent.messages[0].seq}`, bob.token);
    assert.equal(older.hasMore, false);
    const ids = [...older.messages, ...recent.messages].map((item) => item.id);
    assert.equal(ids.length, 68); assert.equal(new Set(ids).size, 68);
  });
  await t.test('saved profile changes update the conversation participant name', async () => {
    const changed = await request(app, '/auth/me', bob.token, { ...bob.account.personal, fullName: 'Bob Livestock Seller' }, 'PATCH');
    assert.equal(changed.status, 200);
    assert.equal((await request(app, '/sync', alice.token)).conversations[0].participant, 'Bob Livestock Seller');
  });
  await t.test('a send acknowledgement cannot skip incoming messages during reconnection', async () => {
    const service = createMessageService(repository(app, alice.token));
    service.connect(alice.account.id, alice.token); const unwatch = service.watch(conversation.id);
    try {
      await until(() => service.getSnapshot().threads[conversation.id]?.messages.length === 60);
      service.setActive(false);
      for (let index = 0; index < 65; index++) await request(app, `/conversations/${conversation.id}/messages`, bob.token, { text: `Away message ${index}`, clientId: `away-batch-${index}` });
      await service.send(conversation.id, 'Reply before sync resumes', 'reply-before-sync');
      service.setActive(true);
      await until(() => service.getSnapshot().threads[conversation.id]?.messages.some((message) => message.clientId === 'away-batch-64'));
      const messages = service.getSnapshot().threads[conversation.id].messages;
      assert.equal(messages.filter((message) => message.clientId.startsWith('away-batch-')).length, 65);
      assert.equal(messages.filter((message) => message.clientId === 'reply-before-sync').length, 1);
    } finally { unwatch(); service.connect('', ''); }
  });
  await t.test('password change revokes other sessions; logout revokes the current one', async () => {
    const secondLogin = await request(app, '/auth/login', null, { email: 'bob@example.test', password: 'Secure-test-2468' });
    assert.equal((await request(app, '/auth/password', bob.token, { current: 'wrong', next: 'Updated-test-1357' })).status, 400);
    assert.equal((await request(app, '/auth/password', bob.token, { current: 'Secure-test-2468', next: 'Updated-test-1357' })).status, 200);
    assert.equal((await request(app, '/auth/me', secondLogin.token)).status, 401);
    assert.equal((await request(app, '/auth/me', bob.token)).status, 200);
    assert.equal((await request(app, '/auth/logout', bob.token, {})).status, 200);
    assert.equal((await request(app, '/auth/me', bob.token)).status, 401);
    assert.equal((await request(app, '/auth/login', null, { email: 'bob@example.test', password: 'Secure-test-2468' })).status, 401);
    assert.equal((await request(app, '/auth/login', null, { email: 'bob@example.test', password: 'Updated-test-1357' })).status, 200);
  });
});

test('accounts, sessions and message history survive a server restart', async () => {
  const directory = path.resolve(__dirname, '../.expo'); fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, `messaging-test-${process.pid}.sqlite`);
  let app = await start(filename);
  try {
    const buyer = await request(app, '/auth/register', null, person('Persisted Buyer', 'persisted-buyer@example.test'));
    const seller = await request(app, '/auth/register', null, person('Persisted Seller', 'persisted-seller@example.test'));
    const { conversation } = await request(app, '/conversations', buyer.token, { recipientId: seller.account.id });
    await request(app, `/conversations/${conversation.id}/messages`, buyer.token, { text: 'Keep this after restart', clientId: 'persistent' });
    await app.close(); app = await start(filename);
    assert.equal((await request(app, '/auth/me', seller.token)).status, 200);
    assert.equal((await request(app, `/conversations/${conversation.id}/messages`, seller.token)).messages[0].text, 'Keep this after restart');
    assert.equal((await request(app, '/sync', seller.token)).conversations[0].unreadCount, 1);
  } finally {
    await app.close();
    for (const file of [filename, filename + '-wal', filename + '-shm']) if (path.dirname(file) === directory && fs.existsSync(file)) fs.unlinkSync(file);
  }
});
