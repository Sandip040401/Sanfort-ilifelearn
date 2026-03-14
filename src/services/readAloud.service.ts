import apiClient from './api-client';
import {Endpoints} from '@/config';

export const ReadAloudService = {
  getAttempts: async (studentId: string) => {
    const response = await apiClient.get(Endpoints.readAloudAttempts(studentId));
    return response.data?.attempts || response.data?.data?.attempts || [];
  },

  submitAttempt: async (studentId: string, payload: unknown) => {
    const response = await apiClient.post(Endpoints.readAloudAttempts(studentId), payload);
    return response.data;
  },

  getDashboard: async (studentId: string) => {
    const response = await apiClient.get(Endpoints.readAloudDashboard(studentId));
    return response.data || {};
  },
};
