import { createClient } from '@supabase/supabase-js';
import { ApiError } from './api_error';
import { requireFirebaseUser } from './firebase_identity';

function configuration() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new ApiError('Private ID storage is not configured yet.', 503);
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key.startsWith('sb_publishable_')) throw new ApiError('Check the Supabase project URL and publishable key.', 503);
  return { url, key };
}

let bootstrap: { uid: string; promise: Promise<string> } | undefined;
export async function getSupabaseAccessToken(): Promise<string> {
  const user = requireFirebaseUser();
  const current = await user.getIdTokenResult();
  if (requireFirebaseUser().uid !== user.uid) throw new ApiError('Your account changed. Please retry.', 401);
  if (current.claims.role === 'authenticated') return current.token;
  if (!bootstrap || bootstrap.uid !== user.uid) {
    const promise = (async () => {
      const result = await cloudBackendRequest<{ refreshToken: boolean }>('/session/bootstrap');
      const refreshed = await user.getIdTokenResult(result.refreshToken);
      if (requireFirebaseUser().uid !== user.uid) throw new ApiError('Your account changed. Please retry.', 401);
      if (refreshed.claims.role !== 'authenticated') throw new ApiError('The trusted backend has not enabled private ID storage for your account.', 503);
      return refreshed.token;
    })().finally(() => { if (bootstrap?.promise === promise) bootstrap = undefined; });
    bootstrap = { uid: user.uid, promise };
  }
  return bootstrap.promise;
}

let client: ReturnType<typeof createClient> | undefined;
export function getSupabaseClient() {
  if (client) return client;
  const { url, key } = configuration();
  client = createClient(url, key, {
    // Firebase is the only account/session provider; do not create Supabase users.
    accessToken: getSupabaseAccessToken,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export async function cloudBackendRequest<T>(path: string, body?: unknown, signal?: AbortSignal, method: 'GET' | 'POST' | 'PATCH' = body ? 'POST' : 'GET'): Promise<T> {
  const user = requireFirebaseUser();
  const token = await user.getIdToken();
  if (requireFirebaseUser().uid !== user.uid) throw new ApiError('Your account changed. Please retry.', 401);
  const { url: base, key } = configuration();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 30000);
  try {
    const response = await fetch(`${base}/functions/v1/animarket`, {
      method: 'POST', signal: controller.signal,
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, body, method }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(result.error || (response.status === 404
      ? 'The Supabase backend function has not been deployed yet.' : 'The trusted backend could not complete this action.'), response.status);
    if (requireFirebaseUser().uid !== user.uid) throw new ApiError('Your account changed. Please retry.', 401);
    return result as T;
  } catch (error) {
    if (error instanceof ApiError || signal?.aborted) throw error;
    throw new ApiError('Unable to reach the trusted backend. Check your connection and retry.');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
