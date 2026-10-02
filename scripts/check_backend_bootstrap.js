const assert = require('node:assert/strict');
const test = require('node:test');

test('trusted bootstrap authorizes the verified UID and never accepts client roles', async () => {
  const { createHandler, BackendError } = await import('../supabase/functions/animarket/core.mjs');
  const granted = [];
  const handler = createHandler({
    verifySession: async (token) => { if (token !== 'real-session') throw new BackendError('Invalid session.', 401); return { uid: 'actual-user' }; },
    setStorageRole: async (session) => { granted.push(session.uid); return true; },
    ready: () => ({ firebaseCredentialConfigured: false }),
  });
  const request = (value, token = 'real-session') => new Request('https://project.supabase.co/functions/v1/animarket', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: typeof value === 'string' ? value : JSON.stringify(value),
  });
  const success = await handler(request({ path: '/session/bootstrap' }));
  assert.equal(success.status, 200); assert.equal((await success.json()).refreshToken, true);
  assert.deepEqual(granted, ['actual-user']);
  for (const body of [{ uid: 'another-user' }, { role: 'service_role' }, { isReviewer: true }, 'arbitrary', []]) {
    assert.equal((await handler(request({ path: '/session/bootstrap', body }))).status, 400);
  }
  assert.deepEqual(granted, ['actual-user']);
  assert.equal((await handler(request({ path: '/session/bootstrap' }, 'expired-session'))).status, 401);
  assert.equal((await handler(request({ path: '/verification/id' }))).status, 503);
  assert.equal((await handler(request('invalid JSON'))).status, 400);
  assert.equal((await handler(request('x'.repeat(5000)))).status, 413);
  assert.equal((await handler(new Request('https://example.com/functions/v1/animarket', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await handler(new Request('https://example.com/functions/v1/animarket'))).status, 405);
  const health = await handler(new Request('https://example.com/functions/v1/animarket/health'));
  assert.equal(health.status, 200); assert.equal((await health.json()).firebaseCredentialConfigured, false);
});

test('bootstrap errors never leak credential or provider response contents', async () => {
  const { createHandler } = await import('../supabase/functions/animarket/core.mjs');
  const handler = createHandler({ verifySession: async () => { throw new Error('private credential content'); }, setStorageRole: async () => {}, ready: () => ({}) });
  const response = await handler(new Request('https://example.com/functions/v1/animarket', { method: 'POST', headers: { Authorization: 'Bearer real-session' }, body: '{}' }));
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private credential/);
});

test('Firebase token verification enforces signature, issuer, audience, expiry and time claims', async () => {
  const { generateKeyPair, SignJWT, jwtVerify } = await import('jose');
  const { verifyFirebaseToken, firebaseProject } = await import('../supabase/functions/animarket/firebase_token.mjs');
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const now = Math.floor(Date.now() / 1000);
  const claims = { sub: 'real-firebase-uid', iss: `https://securetoken.google.com/${firebaseProject}`, aud: firebaseProject, iat: now, exp: now + 3600, auth_time: now };
  const sign = (patch, key = privateKey) => new SignJWT({ ...claims, ...patch }).setProtectedHeader({ alg: 'RS256' }).sign(key);
  assert.equal((await verifyFirebaseToken(await sign({}), jwtVerify, publicKey)).sub, claims.sub);
  for (const patch of [{ iss: 'https://attacker.example' }, { aud: 'another-project' }, { exp: now - 1 }, { exp: undefined }, { iat: now + 60 }, { auth_time: now + 60 }, { auth_time: undefined }, { sub: '' }, { sub: 'another/uid' }]) {
    await assert.rejects(verifyFirebaseToken(await sign(patch), jwtVerify, publicKey), (error) => error.status === 401);
  }
  const wrongKey = (await generateKeyPair('RS256')).privateKey;
  await assert.rejects(verifyFirebaseToken(await sign({}, wrongKey), jwtVerify, publicKey), (error) => error.status === 401);
});
