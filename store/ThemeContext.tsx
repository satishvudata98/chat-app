import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppTheme, AppThemeName } from '../constants/theme';

const THEME_STORAGE_KEY = 'themePreference';

type ThemeContextType = {
  themeName: AppThemeName;
  setThemeName: (themeName: AppThemeName) => Promise<void>;
  colors: typeof AppTheme.light;
  isLoading: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeNameState] = useState<AppThemeName>('light');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadThemePreference() {
      try {
        const storedTheme = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        if (storedTheme === 'light' || storedTheme === 'dark') {
          setThemeNameState(storedTheme);
        }
      } catch (e) {
        console.error('Failed to load theme preference', e);
      } finally {
        setIsLoading(false);
      }
    }

    loadThemePreference();
  }, []);

  const setThemeName = async (nextThemeName: AppThemeName) => {
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, nextThemeName);
      setThemeNameState(nextThemeName);
    } catch (e) {
      console.error('Failed to save theme preference', e);
    }
  };

  const value = useMemo(
    () => ({
      themeName,
      setThemeName,
      colors: AppTheme[themeName],
      isLoading,
    }),
    [themeName, isLoading],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within a ThemePreferenceProvider');
  }

  return context;
}
