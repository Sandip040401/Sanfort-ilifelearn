import apiClient from './api-client';
import {Endpoints, API_BASE_URL} from '@/config';
import type {
  ARAudioResponse,
  ARFoldersResponse,
  ARModelsResponse,
} from '@/types';

const AR_MODELS_BASE = `${API_BASE_URL}${Endpoints.arModels}`;

export const ARService = {
  // 3D models — uses raw fetch (public, no auth needed)
  getAllModels: async (): Promise<ARModelsResponse> => {
    const res = await fetch(AR_MODELS_BASE);
    if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
    return res.json();
  },

  getModelById: async (id: string): Promise<any> => {
    const res = await fetch(`${AR_MODELS_BASE}/${id}`);
    if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
    return res.json();
  },

  getModelAudios: async (id: string): Promise<ARAudioResponse> => {
    const res = await fetch(`${AR_MODELS_BASE}/${id}/audios`);
    if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
    return res.json();
  },

  getModelFileUrl: (id: string) => `${AR_MODELS_BASE}/${id}/file`,

  getPreviewImageUrl: (id: string) => `${AR_MODELS_BASE}/${id}/preview`,

  getAudioStreamUrlById: (audioId: string) => `${AR_MODELS_BASE}/audio/${audioId}`,

  getFolders: () =>
    apiClient.get<ARFoldersResponse>(Endpoints.arFolders),
};
