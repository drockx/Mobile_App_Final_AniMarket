// Owner-only publication of researched public data. No billing or service is enabled.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const auth = require('firebase-tools/lib/auth');
const scopes = require('firebase-tools/lib/scopes');
const root = path.resolve(__dirname, '..');
const project = 'animarket-87354';
async function main() {
  const { createFirestore } = await import('../supabase/functions/animarket/firestore.mjs');
  const { validateMarketPrice } = await import('../supabase/functions/animarket/market_prices.mjs');
  const record = JSON.parse(fs.readFileSync(path.join(root, 'data/market_references/davao_del_norte.json'), 'utf8'));
  assert.equal(record.location, 'Davao del Norte'); assert.equal(record.scope, 'province'); assert.equal(record.sample, false); assert.equal(record.prices.length, 5);
  record.prices.forEach((price) => { validateMarketPrice({ ...price, confirmed: true }); assert.equal(price.revision, 1); assert.equal(price.unit, 'per kg live weight'); });
  const account = auth.getProjectDefaultAccount(root);
  if (!account) throw new Error('Sign in to Firebase CLI with the project-owner account first.');
  const credentials = await auth.getAccessToken(account.tokens.refresh_token, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
  const response = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`, { headers: { Authorization: `Bearer ${credentials.access_token}` }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Could not confirm the Firebase billing state.');
  const billing = await response.json();
  if (billing.billingEnabled || billing.billingAccountName) throw new Error('Publication stopped: AniMarket requires billing disabled.');
  const store = createFirestore({ project, accessToken: async () => credentials.access_token });
  const result = await store.transact(async (tx) => {
    const existing = await tx.get(`marketReferences/${record.id}`);
    if (existing) return 'Reference already exists; existing admin edits were preserved.';
    tx.set(`marketReferences/${record.id}`, { ...record, updatedAt: new Date().toISOString() });
    return 'Published five researched PSA references with dated monthly history.';
  });
  console.log(result); console.log('Firebase billing remains disabled. No customer records or other references changed.');
}
main().catch((issue) => { console.error(issue instanceof assert.AssertionError ? 'Research validation failed.' : issue.message || 'Publication failed.'); process.exitCode = 1; });
