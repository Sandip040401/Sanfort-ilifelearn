import {Platform} from 'react-native';

const ANDROID_LOCALHOST    = '10.0.2.2';
const IOS_LOCALHOST        = 'localhost';
const PRODUCTION_API_BASE  = 'https://learn-api.eduzon.ai/api';
const USE_PRODUCTION_IN_DEV = true;

const localhost = Platform.select({
  android: ANDROID_LOCALHOST,
  ios:     IOS_LOCALHOST,
})!;

export const API_BASE_URL = __DEV__
  ? USE_PRODUCTION_IN_DEV
    ? PRODUCTION_API_BASE
    : `http://${localhost}:5000/api`
  : PRODUCTION_API_BASE;

export const Endpoints = {
  // Auth
  login:    '/learn/auth/login',
  register: '/learn/auth/register',

  // Profile
  profile: '/learn/user/profile',

  // AR
  arModels:  '/modals-3d',
  arFolders: '/folders',

  // WebVR
  webvrFolders:  '/webvr-folder',
  webvrContent:  (folderId: string) => `/webvr/${folderId}`,
  webvrAllItems: '/webvr/all',

  // Games
  games:          '/learn/games',
  gamesByTopic:   (topicId: string) => `/learn/games/topic/${topicId}`,

  // Read Aloud
  readAloudAttempts:  (studentId: string) => `/learn/user/student/${studentId}/attempts`,
  readAloudDashboard: (studentId: string) => `/learn/user/student/${studentId}/read-aloud-student-dashboard`,

  // Books / Ebooks
  concepts:          (grade: string, subject: string) => `/home/concepts/${grade}/${subject}`,
  ebooks:            (category: string, subject: string) => `/ebooks/${category}/${subject}`,
  conceptVideos:     '/explanatory-videos/concept-videos',
  explanatoryVideos: '/explanatory-videos',
} as const;
