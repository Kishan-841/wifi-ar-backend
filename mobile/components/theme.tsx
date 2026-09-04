import { ReactNode, createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

/**
 * Theme tokens. The heatmap band colors (green→red) are SEMANTIC and live in
 * lib/heatmapColor.ts — they never change with the theme. The theme is the
 * quiet stage those colors perform on: violet, because radio waves sit just
 * past violet on the spectrum, and because violet collides with no band color.
 */

export type Theme = {
  mode: 'dark' | 'light';
  bg: string;
  card: string;
  /** Card floating over the camera view — needs translucency. */
  overlayCard: string;
  inputBg: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  /** Primary action background (same brand violet in both modes). */
  primary: string;
  danger: string;
  success: string;
  warn: string;
};

const dark: Theme = {
  mode: 'dark',
  bg: '#141021',
  card: '#1d1731',
  overlayCard: 'rgba(29, 23, 49, 0.93)',
  inputBg: '#141021',
  text: '#f4f1fb',
  muted: '#a49ac2',
  border: '#322a4d',
  accent: '#a78bfa',
  primary: '#6d4fc4',
  danger: '#c62839',
  success: '#1b5e20',
  warn: '#e65100',
};

const light: Theme = {
  mode: 'light',
  bg: '#f5f3fa',
  card: '#ffffff',
  overlayCard: 'rgba(255, 255, 255, 0.94)',
  inputBg: '#efecf7',
  text: '#251f3d',
  muted: '#6f678c',
  border: '#e5e0f0',
  accent: '#6d4fc4',
  primary: '#6d4fc4',
  danger: '#c62839',
  success: '#2e7d32',
  warn: '#e65100',
};

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: dark,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(); // follows the Android system setting
  const [override, setOverride] = useState<'dark' | 'light' | null>(null);
  const mode = override ?? (system === 'light' ? 'light' : 'dark');

  const value = useMemo(
    () => ({
      theme: mode === 'light' ? light : dark,
      toggle: () => setOverride(mode === 'light' ? 'dark' : 'light'),
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
