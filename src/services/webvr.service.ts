import apiClient from './api-client';
import {Endpoints} from '@/config';

export const WebVRService = {
  getFolders: (params?: {category?: string; subject?: string}) =>
    apiClient.get(Endpoints.webvrFolders, {params}),

  getContent: (folderId: string) =>
    apiClient.get(Endpoints.webvrContent(folderId)),

  getAllContents: () =>
    apiClient.get(Endpoints.webvrAllItems),
};
