import apiClient from './api-client';
import {Endpoints} from '@/config';
import type {ApiResponse, ConceptsResponse} from '@/types';

export const BooksService = {
  /** Main endpoint — returns concepts, ebooks, videos, arSheets for a grade+subject */
  getConceptsForHome: (grade: string, subject: string) =>
    apiClient.get<ApiResponse<ConceptsResponse>>(Endpoints.concepts(grade, subject)),

  getEbooks: (category: string, subject: string) =>
    apiClient.get(Endpoints.ebooks(category, subject)),

  getConceptVideos: (params: {category: string; subject: string}) =>
    apiClient.get(Endpoints.conceptVideos, {params}),

  getExplanatoryVideos: (params: {category: string; subject: string}) =>
    apiClient.get(Endpoints.explanatoryVideos, {params}),
};
