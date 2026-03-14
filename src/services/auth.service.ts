import apiClient from './api-client';
import {Endpoints} from '@/config';
import type {LoginRequest, LoginResponse} from '@/types';

export const AuthService = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>(Endpoints.login, data),

  register: (data: LoginRequest) =>
    apiClient.post<LoginResponse>(Endpoints.register, data),
};
