const WEAK_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345678', 'qwerty',
  'abc123', 'monkey', 'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou',
  'master', 'sunshine', 'princess', 'football', 'admin', 'welcome', 'login',
  'passw0rd', 'Password1', 'Password123', 'Tripoli1', 'Tripoli123'
]);

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  const p = password.trim();
  if (p.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (p.length > 128) {
    return { valid: false, error: 'Password must be under 128 characters' };
  }
  if (!/[A-Z]/.test(p)) {
    return { valid: false, error: 'Password must contain an uppercase letter' };
  }
  if (!/[a-z]/.test(p)) {
    return { valid: false, error: 'Password must contain a lowercase letter' };
  }
  if (!/[0-9]/.test(p)) {
    return { valid: false, error: 'Password must contain a number' };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p)) {
    return { valid: false, error: 'Password must contain a special character (!@#$%^&* etc.)' };
  }
  if (WEAK_PASSWORDS.has(p.toLowerCase())) {
    return { valid: false, error: 'This password is too common. Choose a stronger one.' };
  }
  if (/(.)\1{3,}/.test(p)) {
    return { valid: false, error: 'Avoid repeated characters (e.g. aaaa)' };
  }
  return { valid: true };
}

module.exports = { validatePassword };
