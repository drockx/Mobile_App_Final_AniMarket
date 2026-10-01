export function phoneUrl(phone?: string): string | null {
  if (!phone || !/^[+\d\s()-]+$/.test(phone.trim())) return null;
  const number = phone.replace(/[\s()-]/g, '');
  return /^\+?\d{7,15}$/.test(number) ? `tel:${number}` : null;
}
