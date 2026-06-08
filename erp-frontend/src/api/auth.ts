import client from './client';
import type { LoginResult, OtpChannel } from '../types';

export const authApi = {
  validateCredentials: (login: string, password: string) =>
    client.post<{ status: boolean; channels?: OtpChannel[]; must_change_password?: boolean; message: string }>(
      '/auth/validate-credentials', { login, password }
    ),

  sendOtp: (login: string, channel: 'email' | 'sms') =>
    client.post<{ status: boolean; maskedContact: string; channel: string; message: string }>(
      '/auth/send-otp', { login, channel }
    ),

  verifyOtp: (login: string, otp: string) =>
    client.post<LoginResult>('/auth/verify-otp', { login, otp }),

  // Used when must_change_password = true
  directLogin: (login: string, password: string) =>
    client.post<LoginResult>('/auth/login', { login, password }),
};
