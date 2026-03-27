import { Route } from 'react-router-dom';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ForgotPassword from '../pages/ForgotPassword';
import VerifyEmail from '../pages/VerifyEmail';

export const AuthRoutes = (
  <>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/verify-email" element={<VerifyEmail />} />
  </>
);
