import client from './client';
import type { LoginResult, OtpChannel } from '../types';

export const authApi = {
  validateCredentials: (login: string, password: string) =>
    client.post<{
      status: boolean;
      channels?: OtpChannel[];
      must_change_password?: boolean;
      erpToken?: string;
      user?: { email: string; full_name: string };
      message: string;
    }>('/auth/validate-credentials', { login, password }),

  sendOtp: (login: string, channel: 'email' | 'sms') =>
    client.post<{ status: boolean; maskedContact: string; channel: string; message: string }>(
      '/auth/send-otp', { login, channel }
    ),

  verifyOtp: (login: string, otp: string) =>
    client.post<LoginResult>('/auth/verify-otp', { login, otp }),

  directLogin: (login: string, password: string) =>
    client.post<LoginResult>('/auth/login', { login, password }),

  // Change password — called when must_change_password = true
  // Requires the ERP change-password token in Authorization header
  changePassword: (login: string, currentPassword: string, newPassword: string, erpToken: string) =>
    client.post<LoginResult>(
      '/auth/change-password',
      { login, currentPassword, newPassword },
      { headers: { Authorization: `Bearer ${erpToken}` } }
    ),
};
