// Confirms the initial, researched Pig reference through the real admin endpoint.
// It preserves the published amount/date/source and only runs on revision 1.
// Never run this as a recurring test or use it to overwrite newer admin reports.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function main() {
  if (!process.argv.includes('--confirm-initial-publication')) throw new Error('Explicit initial publication confirmation is required.');
  const root = path.resolve(__dirname, '..');
  const login = fs.readFileSync(path.join(root, 'admin-login.local.txt'), 'utf8');
  const read = (label) => login.match(new RegExp(`^${label}: (.+)$`, 'm'))?.[1].trim();
  const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
  const setting = (key) => env.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1].trim();
  const research = JSON.parse(fs.readFileSync(path.join(root, 'data/market_references/davao_del_norte.json'), 'utf8'));
  const expected = research.prices.find((price) => price.id === 'pig-1');
  const signedIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(setting('EXPO_PUBLIC_FIREBASE_API_KEY'))}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: read('Email'), password: read('Password'), returnSecureToken: true }), signal: AbortSignal.timeout(30000),
  });
  assert.equal(signedIn.status, 200); const session = await signedIn.json(); assert.equal(session.localId, read('UID'));
  async function request(path, body, method = 'GET') {
    const response = await fetch(`${setting('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/animarket`, { method: 'POST', headers: { authorization: `Bearer ${session.idToken}`, apikey: setting('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify({ path, body: body ?? {}, method }), signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200); return response.json();
  }
  const markets = (await request('/admin/market-references')).markets;
  const market = markets.find((record) => record.id === research.id), current = market?.prices.find((price) => price.id === expected.id);
  if (!current || current.revision !== 1) { console.log('Initial confirmation skipped; an existing admin revision was preserved.'); return; }
  for (const key of ['min', 'max', 'statistic', 'observedAt', 'sourceName', 'sourceUrl', 'notes']) assert.equal(current[key], expected[key]);
  const result = await request(`/admin/market-references/${market.id}/prices/${current.id}`, { revision: current.revision, min: expected.min, max: expected.max, statistic: expected.statistic, observedAt: expected.observedAt, sourceName: expected.sourceName, sourceUrl: expected.sourceUrl, notes: expected.notes, confirmed: true }, 'POST');
  assert.equal(result.price.revision, 2); assert.equal(result.price.min, 189.50); assert.equal(result.price.observedAt, '2026-06-30'); assert.equal(result.price.historyEntries.length, 6);
  assert.deepEqual(result.market.prices.filter((price) => price.id !== expected.id), market.prices.filter((price) => price.id !== expected.id));
  const saved = (await request('/admin/market-references')).markets.find((record) => record.id === market.id).prices.find((price) => price.id === expected.id);
  assert.equal(saved.revision, 2); assert.equal(saved.sourceUrl, expected.sourceUrl); assert.equal(saved.min, expected.min);
  console.log('Real admin publication and persisted read-back passed. The researched Pig price, observation date and all other references were preserved; the source confirmation is audited.');
}
main().catch(() => { console.error('Initial market publication confirmation failed. Private credentials and provider responses were not printed.'); process.exitCode = 1; });
