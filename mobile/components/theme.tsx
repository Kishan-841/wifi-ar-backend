import { ReactNode, createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

/**
 * Theme tokens — Emerald identity (user-specified palette: #10B981 primary,
 * #34D399 secondary, #059669 dark shade, #6EE7B7 highlight).
 * Primary drives actions (buttons, active tab); the highlight/dark shades act
 * as the accent for highlighted values, per mode. The Wi-Fi strength band colors
 * are SEMANTIC and live in lib/heatmapColor.ts — identical in both modes.
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
  /** Secondary accent (cyan) — highlighted values, live numbers. */
  accent: string;
  /** Primary action color (electric blue) — buttons, active tab. */
  primary: string;
  danger: string;
  success: string;
  warn: string;
  info: string;
};

const dark: Theme = {
  mode: 'dark',
  bg: '#0B1512',
  card: '#13241c',
  overlayCard: 'rgba(19, 36, 28, 0.93)',
  inputBg: '#0B1512',
  text: '#f0f7f2',
  muted: '#8fa89b',
  border: '#22402f',
  accent: '#6EE7B7',
  primary: '#10B981',
  danger: '#dc2626',
  success: '#15803d',
  warn: '#ea580c',
  info: '#475569',
};

const light: Theme = {
  mode: 'light',
  bg: '#F6FBF8',
  card: '#ffffff',
  overlayCard: 'rgba(255, 255, 255, 0.94)',
  inputBg: '#eaf4ee',
  text: '#132920',
  muted: '#5f7268',
  border: '#dcebe2',
  // Emerald-600 for text accents: the brighter brand shades fail contrast on
  // white; #34D399/#6EE7B7 still appear in dots/chips where contrast permits.
  accent: '#059669',
  primary: '#10B981',
  danger: '#dc2626',
  success: '#16a34a',
  warn: '#ea580c',
  info: '#64748b',
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
