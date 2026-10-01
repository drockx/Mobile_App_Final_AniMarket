import type { Href } from 'expo-router';

export function loginDestination(returnTo?: string): Href {
  if (returnTo === '/messages' || returnTo === '/home' || returnTo === '/listings/create' || returnTo === '/account_verification') return returnTo;
  if (returnTo && /^\/messages\/[a-zA-Z0-9-]{1,80}$/.test(returnTo)) return returnTo as Href;
  return '/home';
}
