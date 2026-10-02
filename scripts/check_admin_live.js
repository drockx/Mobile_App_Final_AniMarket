// Read-only production probe. Private login and tokens never enter tool output.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function main() {
  const root = path.resolve(__dirname, '..'); const login = fs.readFileSync(path.join(root, 'admin-login.local.txt'), 'utf8');
  const read = (label) => login.match(new RegExp(`^${label}: (.+)$`, 'm'))?.[1].trim();
  const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8'); const setting = (key) => env.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1].trim();
  const page = await fetch(read('Portal')); assert.equal(page.status, 200); assert.ok(page.headers.get('content-security-policy')?.includes("frame-ancestors 'none'")); assert.equal(page.headers.get('cache-control'), 'no-store');
  for (const asset of ['/app.js', '/styles.css', '/market_prices.js']) assert.equal((await fetch(`${read('Portal')}${asset}`)).status, 200);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(setting('EXPO_PUBLIC_FIREBASE_API_KEY'))}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: read('Email'), password: read('Password'), returnSecureToken: true }) });
  assert.equal(response.status, 200); const session = await response.json(); assert.equal(session.localId, read('UID')); assert.equal(JSON.parse(Buffer.from(session.idToken.split('.')[1], 'base64url').toString()).review_only, true);
  const endpoint = `${setting('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/animarket`;
  async function action(path, method = 'GET') { const response = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${session.idToken}`, apikey: setting('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify({ path, method, body: {} }) }); return { status: response.status, data: await response.json() }; }
  const queue = await action('/verification/reviews'); assert.equal(queue.status, 200); assert.ok(Array.isArray(queue.data.reviews));
  const market = await action('/admin/market-references'); assert.equal(market.status, 200); assert.ok(market.data.markets.some((row) => row.location === 'Davao del Norte' && row.prices.length === 5));
  for (const route of ['/uploads', '/orders/save', '/auth/photo', '/calls']) assert.equal((await action(route, 'POST')).status, 403);
  const unauthorized = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/verification/reviews' }) }); assert.equal(unauthorized.status, 401);
  console.log('Hosted portal, admin login, review queue, five live market references, staff-only scope and unauthenticated denial passed. No customer data changed.');
}
main().catch(() => { console.error('Admin connectivity check failed. No private login or response contents were printed.'); process.exitCode = 1; });
