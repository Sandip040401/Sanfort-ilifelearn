import {createMMKV} from 'react-native-mmkv';

const storage = createMMKV({id: 'ilifelearn-storage'});

const KEYS = {
  TOKEN: 'auth_token',
  USER:  'auth_user',
} as const;

export const AuthStorage = {
  getToken: (): string | null => {
    const v = storage.getString(KEYS.TOKEN);
    return v && v.length > 0 ? v : null;
  },

  setToken: (token: string) => {
    storage.set(KEYS.TOKEN, token);
  },

  getUser: <T>(): T | null => {
    const json = storage.getString(KEYS.USER);
    if (!json || json.length === 0) {return null;}
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  },

  setUser: <T>(user: T) => {
    storage.set(KEYS.USER, JSON.stringify(user));
  },

  clear: () => {
    storage.set(KEYS.TOKEN, '');
    storage.set(KEYS.USER, '');
  },
};

export {storage};
