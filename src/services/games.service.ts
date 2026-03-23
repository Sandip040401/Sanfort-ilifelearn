import apiClient from './api-client';
import {Endpoints} from '@/config';
import type {GamesResponse} from '@/types';

export const GamesService = {
  getAllGames: (params?: {category?: string; page?: number; limit?: number}) =>
    apiClient.get<GamesResponse>(Endpoints.games, {params}),

  getGamesByTopic: (topicId: string) =>
    apiClient.get(Endpoints.gamesByTopic(topicId)),
};
