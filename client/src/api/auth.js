import { baseApi } from './base';

export const auth = {
  googlePublicConfig: () => baseApi.get('/api/auth/google-public-config'),
  checkUsername: (username) =>
    baseApi.get(`/api/auth/check-username?username=${encodeURIComponent(username || '')}`),
  login: (email, password) => baseApi.post('/api/auth/login', { email, password }),
  google: (credential) => baseApi.post('/api/auth/google', { credential }),
  register: (name, username, email, password) =>
    baseApi.post('/api/auth/register', { name, username, email, password }),
  verifyEmail: (email, code) => baseApi.post('/api/auth/verify-email', { email, code }),
  forgotPassword: (email) => baseApi.post('/api/auth/forgot-password', { email }),
  resetPassword: (email, code, newPassword) =>
    baseApi.post('/api/auth/reset-password', { email, code, newPassword }),
  createChromeHandoff: () => baseApi.post('/api/auth/chrome-handoff', {}),
  consumeChromeHandoff: (code) => baseApi.post('/api/auth/chrome-handoff/consume', { code }),
};
