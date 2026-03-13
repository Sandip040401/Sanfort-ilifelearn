import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '@/store/auth-storage';
import { LightColors, DarkColors, type AppColors } from './colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  colors: AppColors;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY         = 'app_theme_mode';
const THEME_VERSION_KEY = 'app_theme_version';
const THEME_VERSION     = '2'; // bump to reset saved theme on next launch

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();

  const [mode, setModeState] = useState<ThemeMode>(() => {
    // One-time migration: if saved on an older version, reset to 'system'
    const version = storage.getString(THEME_VERSION_KEY);
    if (version !== THEME_VERSION) {
      storage.set(THEME_KEY, 'system');
      storage.set(THEME_VERSION_KEY, THEME_VERSION);
    }
    const saved = storage.getString(THEME_KEY);
    return (saved as ThemeMode) || 'system';
  });

  const isDark =
    mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const colors = isDark ? DarkColors : LightColors;

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    storage.set(THEME_KEY, m);
  }, []);

  const toggle = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark, setMode]);

  const value = useMemo(
    () => ({ colors, mode, isDark, setMode, toggle }),
    [colors, mode, isDark, setMode, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
