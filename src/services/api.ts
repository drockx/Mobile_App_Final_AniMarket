import Constants from 'expo-constants';
import { Platform } from 'react-native';

export class ApiError extends Error {
  constructor(message: string, public readonly status = 0) { super(message); }
}
let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | undefined;
export function setAccessToken(token: string | null) { accessToken = token; }
export function getAccessToken() { return accessToken; }
export function onUnauthorized(handler: () => void) { unauthorizedHandler = handler; }
export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;
  if (__DEV__) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:3001`;
    const host = Constants.expoConfig?.hostUri;
    if (host) {
      const hostname = new URL(`http://${host}`).hostname;
      if (/^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.)/.test(hostname)) return `http://${hostname}:3001`;
    }
  }
  throw new ApiError('Messaging is not configured yet. Please contact the app administrator.');
}
type RequestOptions = { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; signal?: AbortSignal; public?: boolean; token?: string | null; timeout?: number };
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.token === undefined ? accessToken : options.token;
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, options.timeout ?? 12000);
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method: options.method ?? 'GET', signal: controller.signal,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(!options.public && token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && !options.public && token === accessToken) unauthorizedHandler?.();
      throw new ApiError(typeof data.error === 'string' ? data.error : 'Unable to complete your request.', response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError || options.signal?.aborted) throw error;
    throw new ApiError('Unable to connect. Check your connection and try again.');
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}
