import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createMarketPrices, validateMarketPrice } from '../supabase/functions/animarket/market_prices.mjs';
import { authorizeAction, authorizeProfile } from '../supabase/functions/animarket/session_access.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const market = JSON.parse(fs.readFileSync(path.join(root, 'data/market_references/davao_del_norte.json'), 'utf8'));
const evidence = JSON.parse(fs.readFileSync(path.join(root, 'data/market_references/psa_query.json'), 'utf8'));
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'src/features/market_reference/domain/market_reference.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const model = { exports: {} }; new Function('module', 'exports', compiled)(model, model.exports);
const { isMarketRecord, marketForLocality } = model.exports;
const now = () => Date.parse('2026-10-02T04:00:00Z');
const edit = (patch = {}) => ({ revision: 1, min: 200, max: 200, statistic: 'average', observedAt: '2026-10-01', sourceName: 'Verified local report', sourceUrl: 'https://example.org/report', notes: 'Test only; never sent to production.', confirmed: true, ...patch });
function fixture() {
  const rows = new Map([['roles/admin', { staff: true, reviewer: true }], ['roles/reviewer', { reviewer: true }], [`marketReferences/${market.id}`, structuredClone(market)]]);
  let queue = Promise.resolve();
  const get = async (key) => structuredClone(rows.get(key) ?? null);
  const store = { get, query: async (prefix) => [...rows].filter(([key]) => key.startsWith(prefix + '/')).map(([, value]) => structuredClone(value)), transact: (action) => {
    const task = queue.catch(() => {}).then(async () => {
      const writes = [];
      const result = await action({ get, set: (key, value) => writes.push([key, structuredClone(value)]) });
      writes.forEach(([key, value]) => rows.set(key, value)); return result;
    }); queue = task; return task;
  } };
  const handler = createMarketPrices({ store, now });
  const call = (uid, priceId = 'pig-1', body = edit(), method = 'POST') => handler({ uid }, `/admin/market-references/${market.id}/prices/${priceId}`, body, method);
  return { rows, store, handler, call };
}

test('Every published value matches PSA province/commodity/year/month cells; unavailable months stay unavailable', () => {
  assert.equal(isMarketRecord(market), true);
  assert.equal(market.scope, 'province'); assert.equal(market.sample, false);
  assert.deepEqual(market.prices.map((price) => price.min), [235.11, 189.50, 280.01, 120, 190.02]);
  for (const [index, price] of market.prices.entries()) {
    const type = evidence.query.query.find((item) => item.code === 'Type').selection.values[index];
    const raw = evidence.raw.data.filter((row) => row.key[1] === type);
    assert.equal(raw.length, 10);
    assert.deepEqual(raw.filter((row) => Number(row.key[3]) >= 6).map((row) => row.values[0]), ['...', '...', '...', '...']);
    assert.deepEqual(price.history, raw.slice(0, 6).map((row) => Number(row.values[0])));
    assert.equal(price.observedAt, '2026-06-30'); assert.equal(price.statistic, 'average'); assert.equal(price.min, price.max); assert.equal(price.observations, 0);
  }
  const city = { ...market, id: 'tagum', scope: undefined, location: 'Tagum City, Davao del Norte' };
  assert.equal(marketForLocality([market, city], city.location), city);
  assert.equal(marketForLocality([market], 'Panabo City, Davao del Norte'), market);
  for (const patch of [{ observedAt: '2026-02-30' }, { sourceUrl: 'javascript:alert(1)' }, { revision: 0 }, { statistic: 'median' }, { historyEntries: [{ observedAt: '2026-01-01', min: -1 }] }]) {
    assert.equal(isMarketRecord({ ...market, prices: [{ ...market.prices[0], ...patch }] }), false);
  }
});

test('Only trusted staff can read the editor or change prices; ID-only reviewer scope stays limited', async () => {
  const f = fixture();
  for (const uid of ['customer', 'reviewer']) await assert.rejects(f.call(uid), (error) => error.status === 403);
  const scope = authorizeProfile('admin', null, { staff: true, reviewer: true }, true);
  for (const route of ['/admin/market-references', `/admin/market-references/${market.id}/prices/pig-1`, '/verification/reviews']) authorizeAction(scope, route);
  for (const route of ['/uploads', '/orders/save', '/calls', '/admin/market-references/delete', '/admin/market-references/../prices/pig-1']) assert.throws(() => authorizeAction(scope, route));
  assert.throws(() => authorizeAction(authorizeProfile('reviewer', null, { reviewer: true }, true), '/admin/market-references'));
  assert.equal((await f.handler({ uid: 'admin' }, '/admin/market-references', {}, 'GET')).markets.length, 1);
  f.rows.set('roles/admin', { staff: true, reviewer: false }); await assert.rejects(f.call('admin'), (error) => error.status === 403);
});

test('Reject invalid source metadata, dates, precision and unconfirmed edits', () => {
  for (const patch of [{ min: 0 }, { min: Infinity }, { min: '200' }, { min: 200.001 }, { min: 1e6 + 1 }, { max: 199 }, { max: 201 }, { observedAt: '2026-02-30' }, { observedAt: '2026-10-03' }, { sourceName: '' }, { sourceUrl: 'http://example.org' }, { sourceUrl: 'https://127.0.0.1' }, { sourceUrl: 'https://user:password@example.org' }, { confirmed: false }]) assert.throws(() => validateMarketPrice(edit(patch), now));
  assert.equal(validateMarketPrice(edit({ min: 180.25, max: 210.50, statistic: 'range' }), now).max, 210.50);
});

test('Edits are atomic, audited, preserve identity and sources, and update only the selected chicken variant', async () => {
  const f = fixture();
  const result = await f.call('admin', 'poultry-4', edit({ min: 220.25, max: 225.50, statistic: 'range', category: 'pig', name: 'Tampered', unit: 'per kg meat', editorId: 'attacker' }));
  assert.equal(result.price.category, 'poultry'); assert.equal(result.price.name, 'Chicken (Native / Improved)'); assert.equal(result.price.unit, 'per kg live weight');
  assert.equal(result.price.revision, 2); assert.equal(result.price.historyEntries.length, 7); assert.equal(result.price.historyEntries[0].sourceName, 'Philippine Statistics Authority (PSA)');
  assert.equal(result.market.prices.find((price) => price.id === 'poultry-3').min, 120);
  assert.equal(isMarketRecord(result.market), true);
  const audit = f.rows.get(`marketReferenceEdits/${market.id}_poultry-4_2`); assert.equal(audit.editorId, 'admin'); assert.equal(audit.previous.min, 190.02);
  const snapshot = structuredClone([...f.rows]);
  await assert.rejects(f.call('admin', 'poultry-4', edit()), (error) => error.status === 409);
  assert.deepEqual([...f.rows], snapshot);
  await assert.rejects(f.call('admin', 'poultry-4', edit({ revision: 2, observedAt: '2026-05-31' })), (error) => error.status === 400);
});

test('Simultaneous editors cannot overwrite each other; same-date corrections retain one observation', async () => {
  const f = fixture();
  const outcomes = await Promise.allSettled([f.call('admin'), f.call('admin', 'pig-1', edit({ min: 210, max: 210 }))]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find((result) => result.status === 'rejected').reason.status, 409);
  const result = await f.call('admin', 'pig-1', edit({ revision: 2, min: 205, max: 205 }));
  assert.equal(result.price.revision, 3); assert.equal(result.price.historyEntries.length, 7);
  assert.equal(result.price.change, (205 / 189.5 - 1) * 100);
  assert.equal([...f.rows.keys()].filter((key) => key.startsWith('marketReferenceEdits/')).length, 2);
});

test('Role revoked between request authorization and transaction stops all price and audit writes', async () => {
  const f = fixture(); const transact = f.store.transact;
  f.store.transact = (action) => { f.rows.delete('roles/admin'); return transact(action); };
  await assert.rejects(f.call('admin'), (error) => error.status === 403);
  assert.equal(f.rows.get(`marketReferences/${market.id}`).prices[1].revision, 1);
  assert.equal([...f.rows.keys()].some((key) => key.startsWith('marketReferenceEdits/')), false);
});

test('Web editor keeps acknowledged prices, prevents repeated submissions, detects newer edits and clears on sign-out', async () => {
  const html = fs.readFileSync(path.join(root, 'admin_portal/index.html'), 'utf8');
  class Element {
    constructor() { this.value = ''; this.children = []; this.listeners = {}; this.classes = new Set(); this.classList = { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) }; }
    addEventListener(event, action) { this.listeners[event] = action; }
    setAttribute(name, value) { this[name] = value; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    reportValidity() { return true; }
    reset() { this.resetCalled = true; }
  }
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], new Element()]));
  const node = (id) => { assert.ok(elements.has(id), `Missing real markup field: ${id}`); return elements.get(id); };
  const priceFields = new Element(); let notify, resolveSave, requests = 0;
  const document = {
    getElementById: node, createElement: () => new Element(), querySelector: () => priceFields,
    querySelectorAll: (selector) => selector === '#prices-list button' ? node('prices-list').children : [...elements].filter(([id]) => /^price-(min|max|date|source|url|notes|type|confirm)$/.test(id)).map(([, element]) => element),
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, 'admin_portal/market_prices.js'), 'utf8').replace(/^import[^\n]+\n/, '').replace('export function createMarketPrices', 'function createMarketPrices');
  vm.runInNewContext(`${source}\nmodule.exports = { createMarketPrices };`, { module, document, URL, Date, collection: () => ({}), onSnapshot: (_ref, callback) => { notify = callback; return () => {}; } });
  const notices = [];
  const editor = module.exports.createMarketPrices({ db: {}, notice: (message) => notices.push(message), request: async () => { requests++; return new Promise((resolve) => { resolveSave = resolve; }); } });
  editor.start(); const snapshot = (row) => ({ docs: row ? [{ id: row.id, data: () => row }] : [] }); notify(snapshot(market));
  node('prices-list').children[1].listeners.click();
  node('price-min').value = '200'; node('price-date').value = '2026-10-01'; node('price-source').value = 'Local verified report'; node('price-url').value = 'https://example.org/report'; node('price-notes').value = 'Test only';
  node('price-confirm').checked = true;
  node('price-form').listeners.input({ target: node('price-min') }); assert.equal(node('price-confirm').checked, false);
  node('price-confirm').checked = true;
  const action = node('price-form').listeners.submit({ preventDefault() {} });
  assert.equal(editor.busy(), true); assert.equal(node('price-save').disabled, true);
  await node('price-form').listeners.submit({ preventDefault() {} }); assert.equal(requests, 1);
  const changed = structuredClone(market); changed.prices[1] = { ...changed.prices[1], revision: 2, min: 200, max: 200, observedAt: '2026-10-01' };
  resolveSave({ market: changed, price: changed.prices[1] }); await action;
  assert.equal(editor.busy(), false); assert.equal(node('price-min').value, '200.00'); assert.match(notices.at(-1), /published/);
  notify(snapshot(market)); assert.equal(node('price-stale').hidden, true); assert.equal(node('price-save').disabled, false); assert.equal(node('prices-list').children[1].children[1].textContent.includes('₱200.00'), true);
  const newer = structuredClone(changed); newer.prices[1].revision = 3; newer.prices[1].min = newer.prices[1].max = 210;
  notify(snapshot(newer)); assert.equal(node('price-stale').hidden, false); assert.equal(node('price-save').disabled, true); assert.equal(node('price-min').value, '200.00');
  editor.stop(); assert.equal(node('prices-pane').hidden, true); assert.equal(node('prices-list').children.length, 0); assert.equal(node('price-form').resetCalled, true);
  notify(snapshot(newer)); assert.equal(node('prices-list').children.length, 0);
});
