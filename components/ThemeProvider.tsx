import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'komikhq_clipper_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  // Load saved theme on mount
  useEffect(() => {
    async function loadTheme() {
      try {
        if (typeof browser !== 'undefined' && browser.storage?.local) {
          const res = await browser.storage.local.get(STORAGE_KEY);
          if (res[STORAGE_KEY]) {
            setThemeState(res[STORAGE_KEY] as Theme);
            return;
          }
        }
      } catch {
        // Fallback to localStorage
      }
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved) {
        setThemeState(saved);
      }
    }
    loadTheme();
  }, []);

  // Update resolved theme and document class whenever theme changes or system preference changes
  useEffect(() => {
    const root = document.documentElement;

    function applyTheme() {
      let isDark = false;
      if (theme === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else {
        isDark = theme === 'dark';
      }

      const activeTheme = isDark ? 'dark' : 'light';
      setResolvedTheme(activeTheme);

      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        const isDark = e.matches;
        setResolvedTheme(isDark ? 'dark' : 'light');
        if (isDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      if (typeof browser !== 'undefined' && browser.storage?.local) {
        browser.storage.local.set({ [STORAGE_KEY]: newTheme });
      }
    } catch {
      // Fallback to localStorage
    }
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // ignore
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
