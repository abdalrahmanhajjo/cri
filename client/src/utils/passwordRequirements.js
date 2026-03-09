/**
 * Client-side password rules (must match server). Used for live UX only; server validates.
 */
const SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function checkPasswordRequirements(password) {
  const p = typeof password === 'string' ? password : '';
  return {
    minLength: p.length >= 8,
    maxLength: p.length <= 128,
    uppercase: /[A-Z]/.test(p),
    lowercase: /[a-z]/.test(p),
    number: /[0-9]/.test(p),
    special: SPECIAL.test(p),
    noRepeated: !/(.)\1{3,}/.test(p),
  };
}

export function isPasswordValid(password) {
  const r = checkPasswordRequirements(password);
  return (
    r.minLength &&
    r.maxLength &&
    r.uppercase &&
    r.lowercase &&
    r.number &&
    r.special &&
    r.noRepeated
  );
}

export const PASSWORD_REQUIREMENTS = [
  { key: 'minLength', label: 'At least 8 characters' },
  { key: 'uppercase', label: 'One uppercase letter' },
  { key: 'lowercase', label: 'One lowercase letter' },
  { key: 'number', label: 'One number' },
  { key: 'special', label: 'One special character (!@#$%^&* etc.)' },
  { key: 'noRepeated', label: 'No long repeated characters (e.g. aaaa)' },
];
