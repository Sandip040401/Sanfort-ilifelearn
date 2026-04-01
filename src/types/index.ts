// ─── API Response Envelope ────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success:    boolean;
  message:    string;
  data?:      T;
  pagination?: Pagination;
}

export interface Pagination {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

// ─── Auth ─────────────────────────────────────────────────────────────
export interface User {
  id?:     string;
  _id?:    string;
  name:    string;
  email:   string;
  role?:   string;
  gradeName?: string;
}

export interface ClientMeta {
  platform:    string;
  os:          string;
  osVersion:   string;
  appVersion:  string;
  deviceModel: string;
  deviceBrand: string;
  deviceId:    string;
  isEmulator:  boolean;
  timezone:    string;
}

export interface LoginRequest {
  email:      string;
  password:   string;
  clientMeta?: ClientMeta;
}

export interface DeleteAccountRequest {
  email:    string;
  password: string;
}

export interface ResetPasswordRequest {
  email:    string;
  oldPassword: string;
  newPassword: string;
}

export interface LoginResponse {
  user:  User;
  token: string;
}

export interface SendOtpRequest {
  phone:      string;
  clientMeta?: ClientMeta;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
}

export interface VerifyOtpRequest {
  phone:      string;
  otp:        string;
  clientMeta?: ClientMeta;
}

export interface VerifyOtpResponse {
  user:  User;
  token: string;
}

// ─── AR ───────────────────────────────────────────────────────────────
export interface ARModel {
  id?:          string;
  _id?:         string;
  name:         string;
  tags?:        string[];
  file?:        string;
  fileUrl?:     string;
  previewImage?: string;
  preview_image?: string; // New underscore field
  previewUrl?:  string;
  thumbnail?:   string; // New field
  icon?:        string;
  level?:       string | number;
  difficulty?:  string | number;
  folder?:      string; // New ID field
}

export interface ARFolder {
  _id:         string;
  folderName:  string;
  createdAt?:  string;
  updatedAt?:  string;
  name?:       string;
  description?: string;
  imgURL?:     string;
  icon?:       string;
  gradient?:   string;
}

export interface ARModelsResponse {
  modals: ARModel[];
}

export interface ARFoldersResponse {
  data: {
    data: ARFolder[];
  };
  folders?: ARFolder[]; // Supporting direct folders property
}

export interface ARModalsUserResponse {
  success: boolean;
  categories: string[];
  arModals: ARModel[];
}

export interface ARAudioTrack {
  _id?:       string;
  gridfsId:   string;
  language:   string;
  level:      string;
  filename?:  string;
  audioName?: string;
  url?:       string;
}

export interface ARAudioResponse {
  success: boolean;
  audios?: ARAudioTrack[];
}

// ─── Games ────────────────────────────────────────────────────────────
export interface Game {
  id:        string;
  title:     string;
  category:  string;
  url:       string;
  thumbnail?: string;
  icon?:     string;
  skills?:   string[];
}

export interface GamesResponse {
  data: {
    data:    Game[];
    hasMore: boolean;
    page:    number;
  };
}

// ─── Books ───────────────────────────────────────────────────────────
export interface BookTopic {
  id:         string;
  title:      string;
  keyword?:   string;
  images:     string[];
  videos:     string[];
  arSheets:   string[];
  ar?:        any[];
}

export interface BookConcept {
  id:           string;
  title:        string;
  volumeNumber: number;
  topics:       BookTopic[];
  ar?:          any[];
}

export interface EbookPage {
  pageId:           string;
  type:             'imageOnly' | 'imageVideo' | 'writeImage';
  content:          {image?: string; video?: string; position?: 'left' | 'right'};
  lastSavedContent: {image?: string; video?: string; position?: 'left' | 'right'};
}

export interface EbookVolume {
  id:        string;
  title:     string;
  pages:     EbookPage[];
  pdfUrl?:   string;
  thumbnail?: string;
}

export interface Ebook {
  title:     string;
  volumes:   EbookVolume[];
  coverUrl?: string;
}

export interface VideoTopic {
  id:     string;
  title:  string;
  videos: string[];
}

export interface VideoVolume {
  id:     string;
  title:  string;
  topics: VideoTopic[];
}

export interface ConceptsResponse {
  grade:        {name: string; id: string};
  subject:      {name: string; color: string; id: string};
  concepts:     BookConcept[];
  ebooks:       Ebook[];
  videoVolumes: VideoVolume[];
  arSheets:     string[];
}

export interface FlatTopic extends BookTopic {
  conceptTitle: string;
  volumeNumber: number;
  conceptIndex: number;
  color:        string;
  ar?:          any[];
}

export type BookGradeKey = 'hummingbird' | 'dove' | 'macaw';
export type BookSubjectKey = 'literacy' | 'numeracy' | 'science' | 'rhymes';

// ─── Navigation ───────────────────────────────────────────────────────
export type AuthStackParamList = {
  Welcome: undefined;
  Login:   undefined;
  DeleteAccount: undefined;
};

export type MainStackParamList = {
  BottomTabs: undefined;
  Profile:    undefined;
  ARViewer:   {modelId: string; environmentId?: string; openPainter?: boolean; initialPaintMode?: 'model' | 'target'};
  WebVRViewer: {folderId: string; folderName: string};
  GamePlayer:  {gameId: string; gameUrl: string; gameTitle: string};
  BooksStack:  undefined;
  PrivacyPolicy: undefined;
};

export type BottomTabParamList = {
  Home:      undefined;
  AR:        undefined;
  WebVR:     undefined;
  Games:     undefined;
  ReadAloud: undefined;
  Themes:    undefined;
  ARSheets:  undefined;
};

export type WebVRStackParamList = {
  WebVRHome:   undefined;
  WebVRFolder: {folderId: string; folderName: string; gradientColors: [string, string]};
};

export type BooksStackParamList = {
  GradeSelector: undefined;
  Subjects:       {gradeKey: string; gradeName: string; gradeColors: string[]};
  SubjectContent: {gradeKey: string; gradeName: string; subjectKey: string; subjectName: string; subjectColor: string};
  TopicDetail: {
    topic: FlatTopic;
    subjectColor: string;
    subjectName: string;
    gradeName: string;
    gradeKey?: string;
    subjectKey?: string;
  };
};
