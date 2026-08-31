'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const saved = window.localStorage.getItem('teacherhub-theme');
    const next: Theme = saved === 'light' ? 'light' : 'dark';
    setThemeState(next);
    document.documentElement.classList.toggle('theme-light', next === 'light');
    document.documentElement.classList.toggle('theme-dark', next === 'dark');
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem('teacherhub-theme', next);
    document.documentElement.classList.toggle('theme-light', next === 'light');
    document.documentElement.classList.toggle('theme-dark', next === 'dark');
  };

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
