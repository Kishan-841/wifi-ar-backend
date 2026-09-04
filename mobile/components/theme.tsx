import { ReactNode, createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

/**
 * Theme tokens — Electric Blue + Cyan identity (user-specified palette).
 * Primary #2563EB drives actions (buttons, active tab); cyan is the secondary
 * accent for highlighted values and details. The Wi-Fi strength band colors
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
  bg: '#0B1220',
  card: '#151f36',
  overlayCard: 'rgba(21, 31, 54, 0.93)',
  inputBg: '#0B1220',
  text: '#f1f5f9',
  muted: '#94a3b8',
  border: '#293650',
  accent: '#06B6D4',
  primary: '#2563EB',
  danger: '#dc2626',
  success: '#15803d',
  warn: '#ea580c',
  info: '#475569',
};

const light: Theme = {
  mode: 'light',
  bg: '#F8FAFC',
  card: '#ffffff',
  overlayCard: 'rgba(255, 255, 255, 0.94)',
  inputBg: '#eef2f7',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  // Cyan-700 rather than raw #06B6D4: cyan-500 text on white fails contrast;
  // the brand cyan still appears in chips/dots where contrast permits.
  accent: '#0E7490',
  primary: '#2563EB',
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
