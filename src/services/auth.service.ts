import apiClient from './api-client';
import { Endpoints } from '@/config';
import type { LoginRequest, LoginResponse, DeleteAccountRequest, ResetPasswordRequest } from '@/types';

export const AuthService = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>(Endpoints.login, data),

  register: (data: LoginRequest) =>
    apiClient.post<LoginResponse>(Endpoints.register, data),

  deleteAccount: (data: DeleteAccountRequest) =>
    apiClient.post<LoginResponse>(Endpoints.deleteAccount, data),

  resetPassword: (data: ResetPasswordRequest) =>
    apiClient.post<LoginResponse>(Endpoints.resetPassword, data),
};
