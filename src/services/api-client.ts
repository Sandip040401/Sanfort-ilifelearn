import axios from 'axios';
import {API_BASE_URL, Env} from '@/config';
import {AuthStorage} from '@/store/auth-storage';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'x-mobile-key': Env.mobileApiKey,
  },
});

// Attach JWT token to every request
apiClient.interceptors.request.use(config => {
  const token = AuthStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — auto logout
apiClient.interceptors.response.use(
  response => response,
  error => {
    // Only auto-logout on 401 if user was already authenticated (token exists)
    // Prevents clearing storage when login attempt fails with wrong credentials
    if (error.response?.status === 401 && AuthStorage.getToken()) {
      AuthStorage.clear();
    }
    return Promise.reject(error);
  },
);

export default apiClient;
