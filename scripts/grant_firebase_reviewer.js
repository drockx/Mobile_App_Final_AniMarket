// Use only for the registered UID explicitly selected by the project owner.
const path = require('node:path');
const auth = require('firebase-tools/lib/auth');
const scopes = require('firebase-tools/lib/scopes');
const uid = process.argv[2];
const project = 'animarket-87354';
async function main() {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid ?? '')) throw new Error('Supply the selected registered Firebase UID.');
  const owner = auth.getProjectDefaultAccount(path.resolve(__dirname, '..')); if (!owner) throw new Error('Sign in with Firebase CLI first.');
  const token = await auth.getAccessToken(owner.tokens.refresh_token, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
  const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' };
  const response = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`, { headers });
  const billing = await response.json(); if (!response.ok || billing.billingEnabled || billing.billingAccountName) throw new Error('Stopped: Firebase must have no billing account.');
  const { createFirestore } = await import('../supabase/functions/animarket/firestore.mjs'); const store = createFirestore({ project, accessToken: async () => token.access_token });
  await store.transact(async (tx) => { const person = await tx.get(`users/${uid}`); if (person?.id !== uid || person.acceptedTerms !== true) throw new Error('This UID has no completed AniMarket profile.'); const previous = await tx.get(`roles/${uid}`); tx.set(`roles/${uid}`, { ...previous, reviewer: true }); });
  console.log('Reviewer access granted to the selected account. Self-review remains blocked.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
