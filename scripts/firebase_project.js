// Owner-only project setup. Credentials stay in Firebase CLI's credential store.
// This script never enables billing, Storage, Cloud Functions or Identity Platform.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const auth = require('firebase-tools/lib/auth');
const scopes = require('firebase-tools/lib/scopes');

const root = path.resolve(__dirname, '..');
const project = 'animarket-87354';
const mode = process.argv[2] ?? '--check';
const policy = JSON.parse(fs.readFileSync(path.join(root, 'firebase.password-policy.json'), 'utf8'));

async function main() {
  if (!['--check', '--password-policy', '--deploy'].includes(mode)) throw new Error('Use --check, --password-policy or --deploy.');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8')).projects.default, project);
  const account = auth.getProjectDefaultAccount(root);
  if (!account) throw new Error('Run npx firebase login with the project-owner account first.');
  const credentials = await auth.getAccessToken(account.tokens.refresh_token, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
  const headers = { Authorization: `Bearer ${credentials.access_token}`, 'Content-Type': 'application/json' };
  async function google(url, options = {}) {
    const response = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(30000) });
    const data = await response.json();
    if (!response.ok) throw new Error(`Project setup request failed (${response.status}): ${data.error?.message ?? 'Retry later.'}`);
    return data;
  }
  const billing = await google(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`);
  if (billing.billingEnabled || billing.billingAccountName) throw new Error('Deployment stopped: this project is linked to billing. AniMarket requires Spark without a billing account.');
  console.log('Billing verified: disabled, no linked account.');
  const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
  let config = await google(configUrl);
  if (config.signIn?.email?.enabled !== true) throw new Error('Enable Email/Password in Firebase Authentication first.');
  if (mode === '--password-policy') {
    await google(`${configUrl}?updateMask=passwordPolicyConfig`, { method: 'PATCH', body: JSON.stringify({ passwordPolicyConfig: policy }) });
    config = await google(configUrl);
  }
  const actual = config.passwordPolicyConfig;
  const matches = actual?.passwordPolicyEnforcementState === policy.passwordPolicyEnforcementState
    && (actual.forceUpgradeOnSignin ?? false) === policy.forceUpgradeOnSignin
    && Object.entries(policy.passwordPolicyVersions[0].customStrengthOptions).every(([key, value]) => actual.passwordPolicyVersions?.[0]?.customStrengthOptions?.[key] === value);
  console.log(`Email/password enabled. Password policy: ${matches ? '8–21 characters; uppercase, lowercase, number and symbol enforced.' : 'not configured yet.'}`);
  if (mode !== '--check' && !matches) throw new Error('Required password policy is not confirmed.');
  if (mode === '--deploy') {
    const cli = require.resolve('firebase-tools/lib/bin/firebase.js');
    const result = spawnSync(process.execPath, [cli, 'deploy', '--only', 'firestore:rules,firestore:indexes', '--project', project, '--non-interactive'], { cwd: root, stdio: 'inherit' });
    if (result.error) throw new Error('Could not start Firebase CLI.');
    if (result.status !== 0) throw new Error('Firestore deployment did not complete.');
    const after = await google(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`);
    if (after.billingEnabled || after.billingAccountName) throw new Error('Unexpected billing state after deployment.');
    console.log('Firestore account rules deployed. Billing remains disabled.');
  }
}

main().catch((error) => {
  // Do not dump OAuth response objects, headers, tokens or credential-store values.
  console.error(error instanceof assert.AssertionError ? 'The configured project does not match AniMarket.' : error instanceof Error ? error.message : 'Firebase project setup failed.');
  process.exitCode = 1;
});
