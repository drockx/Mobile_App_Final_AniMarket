// Explicit production connectivity probe, with two temporary accounts and one
// tiny test image. Every created resource is tracked and cleaned up in finally.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const { parseEnv } = require('node:util');
const { randomUUID } = require('node:crypto');
const cliAuth = require('firebase-tools/lib/auth');
const scopes = require('firebase-tools/lib/scopes');
const { deleteApp } = require('firebase/app');

const root = path.resolve(__dirname, '..');
const project = 'animarket-87354';
const supabaseRef = 'yvamvsbfbknnasfvqdto';
const manifestPath = path.join(root, 'backend-probe.local.json');
const run = randomUUID();
const resources = { run, users: [], files: [] };
if (!process.argv.includes('--live')) throw new Error('Use --live only when the cloud deployment is ready.');
if (fs.existsSync(manifestPath)) throw new Error('A previous probe needs cleanup. Inspect its resource IDs before starting another.');
for (const [name, value] of Object.entries(parseEnv(fs.readFileSync(path.join(root, '.env.local'), 'utf8')))) {
  if (name.startsWith('EXPO_PUBLIC_')) process.env[name] = value;
}
process.env.EXPO_PUBLIC_BACKEND = 'firebase';
assert.equal(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, project);
assert.equal(process.env.EXPO_PUBLIC_SUPABASE_URL, `https://${supabaseRef}.supabase.co`);
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  return resolve.call(this, name.startsWith('@/') ? path.resolve(root, 'src', name.slice(2)) : name, parent, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { getFirebaseServices } = require('../src/services/firebase.ts');
const { firebaseAccountRequest: request } = require('../src/services/firebase_account.ts');
const { getSupabaseClient, getSupabaseAccessToken } = require('../src/services/supabase.ts');
const manifest = () => fs.writeFileSync(manifestPath, JSON.stringify(resources, null, 2), { mode: 0o600 });

async function main() {
  const owner = cliAuth.getProjectDefaultAccount(root);
  if (!owner) throw new Error('Firebase CLI owner sign-in is required for fixture cleanup.');
  const access = await cliAuth.getAccessToken(owner.tokens.refresh_token, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
  async function google(url, method = 'GET', body) {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${access.access_token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    if (!response.ok && response.status !== 404) throw new Error(`Fixture management failed (${response.status}).`);
    return response.status === 204 || response.status === 404 ? {} : response.json();
  }
  const billing = await google(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`);
  assert.equal(billing.billingEnabled, false); assert.ok(!billing.billingAccountName);
  const { auth, app } = getFirebaseServices();
  assert.equal(auth.currentUser, null);
  manifest();
  async function account(label) {
    const email = `backend-probe-${run}-${label}@example.invalid`;
    try {
      return await request('/auth/register', { method: 'POST', body: { email, fullName: 'Backend Connection Test', phone: '09123456789', city: 'Tagum City', acceptedTerms: true, password: `Probe1!${run.slice(0, 8)}` } });
    } finally {
      if (auth.currentUser?.email === email) { resources.users.push({ uid: auth.currentUser.uid, email }); manifest(); }
    }
  }
  try {
    const first = await account('owner');
    const storage = getSupabaseClient().storage.from('animarket-ids');
    await getSupabaseAccessToken();
    assert.equal((await auth.currentUser.getIdTokenResult()).claims.role, 'authenticated');
    assert.equal(first.account.isReviewer, false); assert.equal(first.account.verification.status, 'unverified');
    const object = `${first.account.id}/backend-probe-${run}.png`;
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1sAAAAASUVORK5CYII=', 'base64');
    resources.files.push(object); manifest();
    const uploaded = await storage.upload(object, image, { contentType: 'image/png', upsert: false });
    assert.equal(uploaded.error, null, 'The Firebase owner must be able to upload to its private folder.');
    const own = await storage.download(object); assert.equal(own.error, null);
    assert.equal((await own.data.arrayBuffer()).byteLength, image.length);
    const overwrite = await storage.update(object, image, { contentType: 'image/png' });
    assert.ok(overwrite.error, 'A submitted ID photo must not be overwritten directly.');
    await request('/auth/logout', { method: 'POST' });
    await account('other'); await getSupabaseAccessToken();
    const otherRead = await storage.download(object); assert.ok(otherRead.error, 'Another account must not read the owner ID.');
    const otherUpload = await storage.upload(`${first.account.id}/backend-probe-${run}-forbidden.png`, image, { contentType: 'image/png' });
    assert.ok(otherUpload.error, 'Another account must not upload into the owner folder.');
    const publicRead = await fetch(`https://${supabaseRef}.supabase.co/storage/v1/object/public/animarket-ids/${object}`, { signal: AbortSignal.timeout(20000) });
    assert.ok(!publicRead.ok, 'The bucket must not serve a public ID photo.');
    console.log('Live Firebase → Supabase connection passed: account signup, trusted storage-role provisioning, private upload/download, immutable photo, cross-account denial and public denial.');
  } finally {
    let cleanupFailed = false;
    for (const file of resources.files) {
      if (!/^[A-Za-z0-9_-]{1,128}\/backend-probe-[a-f0-9-]+\.png$/.test(file)) { cleanupFailed = true; continue; }
      const cli = path.join(root, 'node_modules/supabase/dist/supabase.js');
      const result = spawnSync(process.execPath, [cli, 'storage', 'rm', `ss:///animarket-ids/${file}`, '--linked', '--project-ref', supabaseRef, '--experimental', '--yes'], { cwd: root, encoding: 'utf8' });
      if (result.status !== 0) { console.error('Temporary image cleanup needs a retry. Its path is recorded in the probe manifest.'); cleanupFailed = true; }
    }
    for (const user of resources.users) {
      try {
        const record = (await google(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`, 'POST', { localId: [user.uid] })).users?.[0];
        if (!record) continue;
        assert.equal(record.email, user.email); assert.ok(user.email.startsWith(`backend-probe-${run}-`));
        for (const collection of ['users', 'directory']) await google(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collection}/${encodeURIComponent(user.uid)}`, 'DELETE');
        await google(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:delete`, 'POST', { localId: user.uid });
      } catch { cleanupFailed = true; console.error('Temporary account cleanup needs a retry. Its UID is recorded in the probe manifest.'); }
    }
    await deleteApp(app);
    if (cleanupFailed) throw new Error('Keep backend-probe.local.json and finish its cleanup before another live probe.');
    fs.unlinkSync(manifestPath);
    console.log('Temporary accounts, profiles and test image removed. Firebase billing remains unlinked.');
  }
}
main().catch((error) => { console.error(error instanceof assert.AssertionError ? error.message.split('\n')[0] : error.message || 'Live backend check failed.'); process.exitCode = 1; });
