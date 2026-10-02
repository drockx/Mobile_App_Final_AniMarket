import { BackendError } from './core.mjs';
export const firebaseProject = 'animarket-87354';

export async function verifyFirebaseToken(token, jwtVerify, keys) {
  let claims;
  try {
    ({ payload: claims } = await jwtVerify(token, keys, {
      issuer: `https://securetoken.google.com/${firebaseProject}`, audience: firebaseProject, algorithms: ['RS256'],
    }));
  } catch { throw new BackendError('Your Firebase session is invalid or expired. Sign in again.', 401); }
  const now = Date.now() / 1000;
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 || claims.sub.includes('/')
    || !Number.isFinite(claims.auth_time) || claims.auth_time > now || !Number.isFinite(claims.iat) || claims.iat > now
    || !Number.isFinite(claims.exp) || claims.exp <= now) throw new BackendError('Your Firebase session is invalid.', 401);
  return claims;
}
