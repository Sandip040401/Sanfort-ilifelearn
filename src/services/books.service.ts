import apiClient from './api-client';
import {Endpoints} from '@/config';
import type {ApiResponse, ConceptsResponse} from '@/types';

export const BooksService = {
  /** Fetch all available grades */
  getAllGrades: () =>
    apiClient.get<ApiResponse<any>>(Endpoints.allGrades),

  /** Fetch details for a specific grade by ID */
  getGradeById: (id: string) =>
    apiClient.get<ApiResponse<any>>(Endpoints.gradeById(id)),

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
