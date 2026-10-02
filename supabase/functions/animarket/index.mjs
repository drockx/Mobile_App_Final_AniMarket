/* global Deno */
import { createRemoteJWKSet, importPKCS8, SignJWT, jwtVerify } from 'npm:jose@6.2.10';
import { BackendError, createHandler } from './core.mjs';
import { firebaseProject as project, verifyFirebaseToken } from './firebase_token.mjs';
import { createFirestore } from './firestore.mjs';
import { createMedia } from './media.mjs';
import { createAccounts } from './records.mjs';
import { createAccountActions } from './account_actions.mjs';
import { createCommerce } from './commerce.mjs';
import { createChat } from './chat.mjs';
import { createCalls } from './calls.mjs';
import { createMaintenance } from './maintenance.mjs';
import { authorizeAction, authorizeProfile } from './session_access.mjs';

const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
let credential; let privateKey; let access;
function serviceAccount() {
  if (!credential) {
    const raw = Deno.env.get('FIREBASE_ADMIN_SERVICE_ACCOUNT');
    if (!raw) throw new BackendError('The project owner must configure Firebase credentials in Supabase Edge Function Secrets.', 503);
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new BackendError('The trusted Firebase credentials need to be corrected.', 503); }
    if (parsed.project_id !== project || parsed.client_email !== `animarket-edge@${project}.iam.gserviceaccount.com` || !parsed.private_key) throw new BackendError('The trusted Firebase credentials do not match AniMarket.', 503);
    credential = parsed;
  }
  return credential;
}
async function accessToken() {
  if (access && access.expires > Date.now() + 60000) return access.token;
  const account = serviceAccount();
  privateKey ??= await importPKCS8(account.private_key, 'RS256');
  const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore' }).setProtectedHeader({ alg: 'RS256' })
    .setIssuer(account.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(privateKey);
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new BackendError('The trusted Firebase credentials could not authenticate.', 503);
  access = { token: result.access_token, expires: Date.now() + Number(result.expires_in) * 1000 };
  return access.token;
}
async function authAdmin(action, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:${action}`, {
    method: 'POST', headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) throw new BackendError('Firebase account authorization could not be completed.', 503);
  return result;
}
async function verifySession(token) {
  const claims = await verifyFirebaseToken(token, jwtVerify, jwks);
  const record = (await authAdmin('lookup', { localId: [claims.sub] })).users?.[0];
  if (!record || record.localId !== claims.sub || record.disabled || claims.auth_time < Number(record.validSince ?? 0)) throw new BackendError('Your Firebase session has been revoked. Sign in again.', 401);
  // Use the user's ID token here; Firestore's owner-only rules still apply.
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${encodeURIComponent(claims.sub)}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404 || claims.review_only === true) {
    const scope = authorizeProfile(claims.sub, null, await store.get(`roles/${claims.sub}`), claims.review_only === true);
    return { uid: claims.sub, record, authTime: claims.auth_time, ...scope };
  }
  if (!response.ok) throw new BackendError('Unable to authorize your AniMarket profile. Retry later.', 503);
  const profile = await response.json();
  const scope = authorizeProfile(claims.sub, { id: profile.fields?.id?.stringValue, acceptedTerms: profile.fields?.acceptedTerms?.booleanValue });
  return { uid: claims.sub, record, authTime: claims.auth_time, ...scope };
}
async function setStorageRole(session) {
  if (session.reviewOnly) return false;
  const claims = JSON.parse(session.record.customAttributes || '{}');
  if (claims.role === 'authenticated') return false;
  await authAdmin('update', { localId: session.uid, customAttributes: JSON.stringify({ ...claims, role: 'authenticated' }) });
  return true;
}

const store = createFirestore({ project, accessToken });
const media = createMedia({ env: (key) => Deno.env.get(key) });
const accounts = createAccounts({ store });
const accountActions = createAccountActions({ store, media, accounts, authAdmin });
const commerce = createCommerce({ store, accounts, media });
const chat = createChat({ store, accounts });
const calls = createCalls({ store, accounts, chat, env: (key) => Deno.env.get(key) });
async function action(session, path, body, method) {
  authorizeAction(session, path);
  const result = await accountActions(session, path, body, method) ?? await commerce(session.uid, path, body, method)
    ?? await chat.handle(session.uid, path, body, method) ?? await calls.handle(session.uid, path, body, method);
  if (result === undefined) throw new BackendError('This action is unavailable.', 404); return result;
}
const maintain = createMaintenance({ store, media, calls });
const handler = createHandler({ verifySession, setStorageRole, action, maximumBody: 7500000, ready: () => ({ stage: 'cloud-records', firebaseCredentialConfigured: !!Deno.env.get('FIREBASE_ADMIN_SERVICE_ACCOUNT') }) });
Deno.serve(async (request) => {
  if (new URL(request.url).pathname.endsWith('/maintenance')) {
    const configured = Deno.env.get('MAINTENANCE_TOKEN');
    if (request.method !== 'POST' || !configured || request.headers.get('x-maintenance-token') !== configured) return new Response(null, { status: 401 });
    try { return Response.json(await maintain()); } catch { return Response.json({ error: 'Cleanup will retry on the next run.' }, { status: 503 }); }
  }
  return handler(request);
});
