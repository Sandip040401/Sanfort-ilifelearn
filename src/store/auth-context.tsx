import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {User} from '@/types';
import {AuthStorage} from './auth-storage';

interface AuthState {
  token:           string | null;
  user:            User | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login:      (token: string, user: User) => void;
  logout:     () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({children}: {children: React.ReactNode}) {
  // MMKV is synchronous — read immediately, no async needed
  const initialToken = AuthStorage.getToken();
  const initialUser  = AuthStorage.getUser<User>();

  const [state, setState] = useState<AuthState>({
    token:           initialToken,
    user:            initialUser,
    isLoading:       false,
    isAuthenticated: !!initialToken && !!initialUser,
  });

  const didRefresh = useRef(false);

  const login = useCallback((token: string, user: User) => {
    AuthStorage.setToken(token);
    AuthStorage.setUser(user);
    setState({token, user, isLoading: false, isAuthenticated: true});
    didRefresh.current = false;
  }, []);

  const logout = useCallback(() => {
    AuthStorage.clear();
    setState({token: null, user: null, isLoading: false, isAuthenticated: false});
    didRefresh.current = false;
  }, []);

  const updateUser = useCallback((user: User) => {
    AuthStorage.setUser(user);
    setState(prev => ({...prev, user}));
  }, []);

  const value = useMemo(
    () => ({...state, login, logout, updateUser}),
    [state, login, logout, updateUser],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
