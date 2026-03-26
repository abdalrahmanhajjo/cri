/**
 * Client-side username rules (must match server `usernameValidator`). Live UX only; server validates.
 */

const RESERVED = new Set([
  'admin',
  'administrator',
  'support',
  'help',
  'root',
  'system',
  'visittripoli',
  'tripoli',
  'official',
  'staff',
  'moderator',
]);

const HANDLE_RE = /^[a-z][a-z0-9_]{2,29}$/;

function normalizeHandle(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().replace(/^@+/, '');
}

export function checkUsernameRequirements(raw) {
  const s = normalizeHandle(raw);
  return {
    minLength: s.length >= 3,
    maxLength: s.length <= 30,
    format: HANDLE_RE.test(s),
    notReserved: s.length > 0 && !RESERVED.has(s),
  };
}

export function isUsernameValid(raw) {
  const r = checkUsernameRequirements(raw);
  return r.minLength && r.maxLength && r.format && r.notReserved;
}

export const USERNAME_REQUIREMENTS = [
  { key: 'minLength', label: 'At least 3 characters' },
  { key: 'maxLength', label: 'At most 30 characters' },
  { key: 'format', label: 'Starts with a letter; only lowercase letters, numbers, and underscores' },
  { key: 'notReserved', label: 'Not a reserved name (admin, support, tripoli, etc.)' },
];
