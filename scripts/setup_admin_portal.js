// Creates a separate reviewer login only when the signed-in owner's email is unused.
// Credentials are saved locally; this never resets an existing person's password.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const auth = require('firebase-tools/lib/auth');
const scopes = require('firebase-tools/lib/scopes');
const root = path.resolve(__dirname, '..'), project = 'animarket-87354', site = `${project}-admin`;
const loginPath = path.join(root, 'admin-login.local.txt');
async function main() {
  const owner = auth.getProjectDefaultAccount(root);
  if (!owner?.user?.email) throw new Error('Sign in to Firebase CLI as the project owner first.');
  const token = await auth.getAccessToken(owner.tokens.refresh_token, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
  async function google(url, method = 'GET', body) {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
    const value = await response.json(); if (!response.ok) { const error = new Error(`Admin setup failed (${response.status}). No credentials were printed.`); error.status = response.status; throw error; } return value;
  }
  const billingUrl = `https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`;
  const checkBilling = async () => { const result = await google(billingUrl); if (result.billingEnabled || result.billingAccountName) throw new Error('Stopped: Firebase must have no linked billing account.'); };
  await checkBilling();
  const accountUrl = `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts`;
  const email = owner.user.email.toLowerCase();
  const existing = (await google(`${accountUrl}:lookup`, 'POST', { email: [email] })).users?.[0];
  let uid, password;
  if (existing) {
    if (!fs.existsSync(loginPath)) throw new Error('Owner email already has an account. No password or permissions changed; select its UID explicitly with scripts/grant_firebase_reviewer.js.');
    const saved = fs.readFileSync(loginPath, 'utf8');
    if (!saved.includes(`UID: ${existing.localId}\n`) || !saved.includes(`Email: ${email}\n`) || JSON.parse(existing.customAttributes || '{}').review_only !== true) throw new Error('Existing account is not the saved staff login. Nothing changed.');
    uid = existing.localId;
  } else {
    if (fs.existsSync(loginPath)) throw new Error('A staff login file already exists. Preserve it and check the existing account before retrying.');
    password = `Aa9!${crypto.randomBytes(12).toString('base64url')}`;
    const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8'); const apiKey = env.match(/^EXPO_PUBLIC_FIREBASE_API_KEY=(.+)$/m)?.[1].trim();
    if (!apiKey) throw new Error('Firebase public configuration is missing.');
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: false }), signal: AbortSignal.timeout(30000) });
    const result = await response.json(); if (!response.ok || !result.localId) throw new Error('Staff account creation failed. No existing password was changed.');
    uid = result.localId;
    // Persist access immediately so a later network failure cannot lose the new login.
    fs.writeFileSync(loginPath, `AniMarket private reviewer login\nPortal: https://${site}.web.app\nEmail: ${email}\nPassword: ${password}\nUID: ${uid}\n\nKeep this file private. It is excluded from Git, EAS and Hosting.\n`, { flag: 'wx', mode: 0o600 });
    await google(`${accountUrl}:update`, 'POST', { localId: uid, displayName: 'AniMarket account reviewer', customAttributes: JSON.stringify({ review_only: true }) });
  }
  const { createFirestore } = await import('../supabase/functions/animarket/firestore.mjs');
  const store = createFirestore({ project, accessToken: async () => token.access_token });
  await store.transact(async (tx) => { const previous = await tx.get(`roles/${uid}`); tx.set(`roles/${uid}`, { ...previous, reviewer: true, staff: true, createdAt: previous?.createdAt ?? new Date().toISOString() }); });
  const siteUrl = `https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/${site}`;
  try { await google(siteUrl); } catch (error) { if (error.status !== 404) throw error; await google(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites?siteId=${site}`, 'POST', {}); }
  const configPath = path.join(root, 'firebase.json'); const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.hosting = { site, public: 'admin_portal', ignore: ['firebase.json', '**/.*', '**/node_modules/**'], headers: [{ source: '**', headers: [
    { key: 'Cache-Control', value: 'no-store' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' https://www.gstatic.com; style-src 'self'; img-src 'self' data:; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://yvamvsbfbknnasfvqdto.supabase.co; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
  ] }] };
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const result = spawnSync(process.execPath, [require.resolve('firebase-tools/lib/bin/firebase.js'), 'deploy', '--only', 'hosting', '--project', project, '--non-interactive'], { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Hosting deployment did not finish. The staff login is preserved in admin-login.local.txt.');
  await checkBilling(); console.log(`Admin portal: https://${site}.web.app\nPrivate login saved to admin-login.local.txt. Firebase billing remains disabled.`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
