import type { Href } from 'expo-router';

export function loginDestination(returnTo?: string, isStaff = false): Href {
  if (isStaff) return '/admin';
  if (returnTo === '/messages' || returnTo === '/home' || returnTo === '/listings/create' || returnTo === '/account_verification') return returnTo;
  if (returnTo && /^\/messages\/[a-zA-Z0-9-]{1,80}$/.test(returnTo)) return returnTo as Href;
  if (returnTo && /^\/users\/[a-zA-Z0-9_-]{1,200}$/.test(returnTo)) return returnTo as Href;
  if (returnTo?.startsWith('/order_checkout?id=')) {
    try {
      const id = decodeURIComponent(returnTo.slice('/order_checkout?id='.length));
      if (/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return { pathname: '/order_checkout', params: { id } };
    } catch { /* Invalid links fall back to the marketplace. */ }
  }
  return '/home';
}
