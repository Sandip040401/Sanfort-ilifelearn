import apiClient from './api-client';
import {Endpoints, API_BASE_URL} from '@/config';
import type {
  ARAudioResponse,
  ARFoldersResponse,
  ARModelsResponse,
  ARModalsUserResponse,
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

  getThumbnailImageUrl: (id: string) => `${AR_MODELS_BASE}/${id}/thumbnail`,

  getAudioStreamUrlById: (audioId: string) => `${AR_MODELS_BASE}/audio/${audioId}`,

  getFolders: () =>
    apiClient.get<ARFoldersResponse>(Endpoints.arFolders),

  getALLArModals: (gradeId?: string) =>
    apiClient.get<ARModalsUserResponse>(Endpoints.arModalsUserAll, {params: {grade: gradeId}}),

  getUserArModalById: (id: string, gradeId?: string) =>
    apiClient.get(Endpoints.arModalUserById(id, gradeId)),

  getAllArFolders: (gradeId?: string) =>
    apiClient.get(Endpoints.arFoldersUserAll, {params: {grade: gradeId}}),
};

export const getALLArModals = (gradeId?: string) => ARService.getALLArModals(gradeId);
export const getUserArModalById = (id: string, gradeId?: string) => ARService.getUserArModalById(id, gradeId);
export const getAllArFolders = (gradeId?: string) => ARService.getAllArFolders(gradeId);
