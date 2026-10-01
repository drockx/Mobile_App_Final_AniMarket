// Shared by the mobile form and Node API; passwords are never trimmed or truncated.
const PASSWORD_GUIDANCE = 'Use 8–21 characters with uppercase, lowercase, a number, and a special symbol.';

function passwordRequirements(value) {
  const password = typeof value === 'string' ? value : '';
  return [
    { label: '8–21 characters', met: password.length >= 8 && password.length <= 21 },
    { label: 'Uppercase letter (A–Z)', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter (a–z)', met: /[a-z]/.test(password) },
    { label: 'Number (0–9)', met: /[0-9]/.test(password) },
    { label: 'Special symbol (e.g. ! @ # $)', met: /[\p{P}\p{S}]/u.test(password) },
  ];
}

function passwordError(value) {
  if (typeof value !== 'string' || !value) return 'Password is required.';
  if (passwordRequirements(value).some((rule) => !rule.met)) return PASSWORD_GUIDANCE;
  if (/[\u0000-\u001f\u007f]/.test(value)) return 'Password cannot contain control characters.';
  return null;
}

function emailError(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Email address is required.';
  const email = value.trim();
  const parts = email.split('@');
  if (email.length > 254 || parts.length !== 2) return 'Enter a valid email address.';
  const [local, domain] = parts;
  // Support ordinary mailbox addresses and plus tags, without silently correcting typos.
  if (!local || local.length > 64 || !/^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return 'Enter a valid email address.';
  const labels = domain.split('.');
  if (labels.length < 2 || !/^[a-zA-Z]{2,63}$/.test(labels.at(-1))
    || labels.some((label) => !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))) return 'Enter a valid email address.';
  return null;
}

module.exports = { PASSWORD_GUIDANCE, passwordRequirements, passwordError, emailError };
