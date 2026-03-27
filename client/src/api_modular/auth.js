import { apiBase } from './base';

export const authApi = {
  login: (email, password) => apiBase.post('/api/auth/login', { email, password }),
  register: (name, username, email, password) =>
    apiBase.post('/api/auth/register', { name, username, email, password }),
  verifyEmail: (email, code) => apiBase.post('/api/auth/verify-email', { email, code }),
  forgotPassword: (email) => apiBase.post('/api/auth/forgot-password', { email }),
  resetPassword: (email, code, newPassword) => apiBase.post('/api/auth/reset-password', { email, code, newPassword }),
};
