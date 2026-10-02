export class BackendError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers });

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new BackendError('A JSON request is required.', 400);
  let length = 0; const parts = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) { await reader.cancel(); throw new BackendError('This request is too large.', 413); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new BackendError('A valid JSON request is required.', 400); }
}

// Dependency injection keeps authorization tests independent of cloud secrets.
export function createHandler({ verifySession, setStorageRole, ready }) {
  return async (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method === 'GET' && new URL(request.url).pathname.endsWith('/health')) return json({ stage: 'account-storage-bootstrap', ...ready() });
    if (request.method !== 'POST') return json({ error: 'Use POST for account actions.' }, 405);
    try {
      const bearer = request.headers.get('authorization') ?? '';
      if (!bearer.startsWith('Bearer ') || bearer.length > 8192) throw new BackendError('Sign in with Firebase first.', 401);
      const token = bearer.slice(7);
      const session = await verifySession(token);
      const payload = await readBody(request);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new BackendError('A valid account action is required.', 400);
      if (payload.path !== '/session/bootstrap') throw new BackendError('This backend feature is pending the next connection step.', 503);
      if (payload.body != null && (typeof payload.body !== 'object' || Array.isArray(payload.body) || Object.keys(payload.body).length)) throw new BackendError('Account bootstrap accepts no account ID or role from the app.', 400);
      // The verified Firebase token selects the account. A client can never
      // choose another UID or grant reviewer/administrator privileges here.
      return json({ refreshToken: await setStorageRole(session) });
    } catch (error) {
      return error instanceof BackendError ? json({ error: error.message }, error.status)
        : json({ error: 'The trusted backend is temporarily unavailable. Retry later.' }, 503);
    }
  };
}
