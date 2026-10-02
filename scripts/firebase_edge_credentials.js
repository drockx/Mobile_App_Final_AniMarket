// Provision one narrowly scoped Firebase identity for Supabase's session bridge.
// Its private key is written only to an ignored, server-only secrets file.
const fs = require('node:fs');
const path = require('node:path');
const auth = require('firebase-tools/lib/auth');
const scopes = require('firebase-tools/lib/scopes');
const project = 'animarket-87354';
const email = `animarket-edge@${project}.iam.gserviceaccount.com`;
const roleId = 'animarketStorageSession';
const roleName = `projects/${project}/roles/${roleId}`;
const previousPermissions = ['firebaseauth.users.get', 'firebaseauth.users.update'];
const permissions = [...previousPermissions, 'datastore.databases.get', 'datastore.entities.get', 'datastore.entities.list', 'datastore.entities.create', 'datastore.entities.update', 'datastore.entities.delete'];
const root = path.resolve(__dirname, '..');
const secretFile = path.join(root, '.env.backend-secrets.local');

async function main() {
  const account = auth.getProjectDefaultAccount(root);
  if (!account) throw new Error('Sign in with Firebase CLI first.');
  const credentials = await auth.getAccessToken(account.tokens.refresh_token, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
  async function google(url, method = 'GET', body) {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${credentials.access_token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(`Firebase server-identity setup failed (${response.status}). No private credentials were printed.`);
      error.status = response.status; throw error;
    }
    return result;
  }
  const billing = await google(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`);
  if (billing.billingEnabled || billing.billingAccountName) throw new Error('Stopped: this project must have no linked billing account.');
  const iam = 'https://iam.googleapis.com/v1';
  const serviceUrl = `${iam}/projects/${project}/serviceAccounts/${email}`;
  try { await google(serviceUrl); }
  catch (error) {
    if (error.status !== 404) throw error;
    await google(`${iam}/projects/${project}/serviceAccounts`, 'POST', { accountId: 'animarket-edge', serviceAccount: { displayName: 'AniMarket Supabase session bridge', description: 'Sets only the authenticated storage role for validated AniMarket accounts.' } });
  }
  let role;
  try { role = await google(`${iam}/${roleName}`); }
  catch (error) {
    if (error.status !== 404) throw error;
    role = await google(`${iam}/projects/${project}/roles`, 'POST', { roleId, role: { title: 'AniMarket storage session', description: 'Read account status and set the authenticated storage claim. No database, billing or IAM administration.', includedPermissions: permissions, stage: 'GA' } });
  }
  if (role.deleted || role.includedPermissions.some((permission) => !permissions.includes(permission))) throw new Error('The existing role has unexpected permissions.');
  if (!permissions.every((permission) => role.includedPermissions?.includes(permission))) {
    if (!previousPermissions.every((permission) => role.includedPermissions?.includes(permission))) throw new Error('The existing account permissions do not match.');
    await google(`${iam}/${roleName}`, 'PATCH', { ...role, title: 'AniMarket trusted records', description: 'Account session and application records only. No billing or IAM administration.', includedPermissions: permissions });
  }
  const policyUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
  const policy = await google(`${policyUrl}:getIamPolicy`, 'POST', { options: { requestedPolicyVersion: 3 } });
  const member = `serviceAccount:${email}`;
  const existingRoles = policy.bindings?.filter((binding) => binding.members?.includes(member)) ?? [];
  if (existingRoles.some((binding) => binding.role !== roleName)) throw new Error('This server identity already has unrelated project permissions. Review those before proceeding.');
  let binding = policy.bindings?.find((item) => item.role === roleName && !item.condition);
  if (!binding?.members.includes(member)) {
    policy.bindings ??= [];
    if (!binding) { binding = { role: roleName, members: [] }; policy.bindings.push(binding); }
    binding.members.push(member);
    // Preserve every unrelated binding, condition and the concurrency etag.
    await google(`${policyUrl}:setIamPolicy`, 'POST', { policy });
  }
  if (fs.existsSync(secretFile)) {
    const contents = fs.readFileSync(secretFile, 'utf8');
    const line = contents.split(/\r?\n/).find((value) => value.startsWith('FIREBASE_ADMIN_SERVICE_ACCOUNT='));
    if (!line) throw new Error('The server secrets file exists without a Firebase credential. Keep its existing secrets and configure the credential manually.');
    const saved = JSON.parse(line.slice('FIREBASE_ADMIN_SERVICE_ACCOUNT='.length));
    if (saved.project_id !== project || saved.client_email !== email) throw new Error('The existing server credential belongs to a different identity.');
    console.log('Reusing the existing server-only credential. No new private key created.');
    return;
  }
  const created = await google(`${serviceUrl}/keys`, 'POST', { privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE', keyAlgorithm: 'KEY_ALG_RSA_2048' });
  const key = JSON.parse(Buffer.from(created.privateKeyData, 'base64').toString('utf8'));
  if (key.project_id !== project || key.client_email !== email || !key.private_key) throw new Error('Firebase returned a credential for an unexpected identity.');
  fs.writeFileSync(secretFile, `FIREBASE_ADMIN_SERVICE_ACCOUNT=${JSON.stringify(key)}\n`, { flag: 'wx', mode: 0o600 });
  console.log('Created the limited server identity and saved its private credential to ignored .env.backend-secrets.local. No credentials printed. Billing remains disabled.');
}
main().catch((error) => { console.error(error.message || 'Server credential setup failed.'); process.exitCode = 1; });
