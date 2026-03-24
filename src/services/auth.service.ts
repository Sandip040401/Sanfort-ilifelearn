import apiClient from './api-client';
import { Endpoints } from '@/config';
import type {
  LoginRequest, LoginResponse,
  DeleteAccountRequest, ResetPasswordRequest,
  SendOtpRequest, SendOtpResponse,
  VerifyOtpRequest, VerifyOtpResponse,
} from '@/types';

export const AuthService = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>(Endpoints.login, data),

  register: (data: LoginRequest) =>
    apiClient.post<LoginResponse>(Endpoints.register, data),

  deleteAccount: (data: DeleteAccountRequest) =>
    apiClient.post<LoginResponse>(Endpoints.deleteAccount, data),

  resetPassword: (data: ResetPasswordRequest) =>
    apiClient.post<LoginResponse>(Endpoints.resetPassword, data),

  sendOtp: (data: SendOtpRequest) =>
    apiClient.post<SendOtpResponse>(Endpoints.sendOtp, data),

  verifyOtp: (data: VerifyOtpRequest) =>
    apiClient.post<VerifyOtpResponse>(Endpoints.verifyOtp, data),
};
