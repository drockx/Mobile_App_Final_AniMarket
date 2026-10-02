import { BackendError } from './core.mjs';

export function imageBytes(photo, maximum = 5242880) {
  if (typeof photo !== 'string' || photo.length > Math.ceil(maximum * 4 / 3) + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo) || photo.length % 4) throw new BackendError('Choose a JPEG or PNG image within the upload limit.', 400);
  const binary = atob(photo); const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (bytes.length > maximum) throw new BackendError('This image exceeds the upload limit.', 413);
  const png = bytes.length > 45 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
    && String.fromCharCode(...bytes.slice(12, 16)) === 'IHDR' && String.fromCharCode(...bytes.slice(-8, -4)) === 'IEND';
  const jpeg = bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
  if (!png && !jpeg) throw new BackendError('Choose a valid JPEG or PNG image.', 400);
  return { bytes, mime: png ? 'image/png' : 'image/jpeg' };
}
export function documentBytes(photo) {
  if (typeof photo !== 'string' || photo.length > 6990512 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo) || photo.length % 4) throw new BackendError('Choose a JPEG, PNG, or PDF within 5 MB.', 400);
  const binary = atob(photo); const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (bytes.length > 5242880) throw new BackendError('Choose a document within 5 MB.', 413);
  if (binary.startsWith('%PDF-') && binary.slice(-1024).includes('%%EOF')) return { bytes, mime: 'application/pdf' };
  return imageBytes(photo);
}
export function createMedia({ env, fetcher = fetch, digest = (value) => crypto.subtle.digest('SHA-1', new TextEncoder().encode(value)) }) {
  const storageUrl = () => {
    const url = env('SUPABASE_URL'); if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url ?? '')) throw new BackendError('Private media storage is unavailable.', 503); return url;
  };
  async function storage(bucket, path, method, bytes, mime) {
    if (!['animarket-ids', 'animarket-documents'].includes(bucket) || !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(path)) throw new BackendError('Invalid private media reference.', 400);
    const suffix = method === 'DELETE' ? bucket : `${method === 'GET' ? 'authenticated/' : ''}${bucket}/${path}`;
    const response = await fetcher(`${storageUrl()}/storage/v1/object/${suffix}`, { method,
      headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`, ...(mime ? { 'Content-Type': mime, 'x-upsert': 'false' } : {}), ...(method === 'DELETE' ? { 'Content-Type': 'application/json' } : {}) },
      ...(bytes ? { body: bytes } : method === 'DELETE' ? { body: JSON.stringify({ prefixes: [path] }) } : {}), signal: AbortSignal.timeout(25000) });
    if (!response.ok && !(method === 'DELETE' && response.status === 404)) throw new BackendError('Private media storage could not complete this action. Retry later.', 503);
    return response;
  }
  const sign = async (params) => {
    const secret = env('CLOUDINARY_API_SECRET'); if (!secret) throw new BackendError('Public photo storage is not configured.', 503);
    const value = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${key}=${val}`).join('&') + secret;
    return Array.from(new Uint8Array(await digest(value)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  };
  function cloud() {
    const value = env('CLOUDINARY_CLOUD_NAME'); if (value !== 'dnbmd5qhj' || !env('CLOUDINARY_API_KEY')) throw new BackendError('Public photo storage is not configured.', 503); return value;
  }
  return {
    async publicPhoto(uid, photo, id) {
      const { mime } = imageBytes(photo);
      const params = { public_id: `animarket/${uid}/${id}`, timestamp: String(Math.floor(Date.now() / 1000)), overwrite: 'false' };
      const body = new FormData(); Object.entries(params).forEach(([key, value]) => body.set(key, value));
      body.set('file', `data:${mime};base64,${photo}`); body.set('api_key', env('CLOUDINARY_API_KEY')); body.set('signature', await sign(params));
      const response = await fetcher(`https://api.cloudinary.com/v1_1/${cloud()}/image/upload`, { method: 'POST', body, signal: AbortSignal.timeout(25000) });
      const result = await response.json();
      if (!response.ok || result.public_id !== params.public_id || !result.secure_url?.startsWith(`https://res.cloudinary.com/${cloud()}/image/upload/`)) throw new BackendError('The photo could not be uploaded. Retry later.', 503);
      return { url: result.secure_url, publicId: result.public_id };
    },
    async deletePublic(publicId) {
      if (!/^animarket\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(publicId ?? '')) throw new BackendError('Invalid public photo reference.', 400);
      const params = { public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)), invalidate: 'true' };
      const body = new URLSearchParams({ ...params, api_key: env('CLOUDINARY_API_KEY'), signature: await sign(params) });
      const response = await fetcher(`https://api.cloudinary.com/v1_1/${cloud()}/image/destroy`, { method: 'POST', body, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new BackendError('Photo cleanup is temporarily unavailable.', 503);
    },
    privatePhoto: (bucket, path, photo) => { const { bytes, mime } = imageBytes(photo); return storage(bucket, path, 'POST', bytes, mime); },
    privateDocument: (bucket, path, photo) => { const { bytes, mime } = documentBytes(photo); return storage(bucket, path, 'POST', bytes, mime); },
    async privateRead(bucket, path) {
      const result = await storage(bucket, path, 'GET'); const bytes = new Uint8Array(await result.arrayBuffer());
      let binary = ''; for (let start = 0; start < bytes.length; start += 16384) binary += String.fromCharCode(...bytes.slice(start, start + 16384));
      return `data:${result.headers.get('content-type')};base64,${btoa(binary)}`;
    },
    privateDelete: (bucket, path) => storage(bucket, path, 'DELETE'),
  };
}
