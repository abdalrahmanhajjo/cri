import { http } from './http';
import { adaptUser } from './schemas';

export const authApi = {
  login: async (email, password) => {
    const res = await http.post('/api/auth/login', { email, password });
    if (res.user) res.user = adaptUser(res.user);
    return res;
  },
  register: async (name, username, email, password) => {
    const res = await http.post('/api/auth/register', { name, username, email, password });
    if (res.user) res.user = adaptUser(res.user);
    return res;
  },
  verifyEmail: (email, code) => http.post('/api/auth/verify-email', { email, code }),
  forgotPassword: (email) => http.post('/api/auth/forgot-password', { email }),
  resetPassword: (email, code, newPassword) => http.post('/api/auth/reset-password', { email, code, newPassword }),
};
