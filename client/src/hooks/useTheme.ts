import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'pink';

export interface ThemeOption {
  value: Theme;
  label: string;
  swatch: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { value: 'dark', label: 'Dark', swatch: '#17223b' },
  { value: 'light', label: 'Light', swatch: '#e4ecfb' },
  { value: 'pink', label: 'Pink', swatch: '#f7bcd9' },
];

const isTheme = (value: string | null): value is Theme =>
  value === 'dark' || value === 'light' || value === 'pink';

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (isTheme(savedTheme)) {
      return savedTheme;
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'dark';
  });

  useEffect(() => {
    const htmlElement = document.documentElement;
    if (theme === 'dark') {
      htmlElement.removeAttribute('data-theme');
    } else {
      htmlElement.setAttribute('data-theme', theme);
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
  };

  return { theme, setTheme };
};
