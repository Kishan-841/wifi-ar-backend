import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * User-editable server URL, persisted on the phone. Lets a release build point
 * at any backend (tunnel today, VM tomorrow) without rebuilding the APK.
 * Precedence in lib/api.ts: this setting → EXPO_PUBLIC_API_URL → Metro host.
 */
const KEY = 'wifiar.serverUrl';

let cached: string | null = null;

export async function loadServerUrl(): Promise<string | null> {
  try {
    cached = await AsyncStorage.getItem(KEY);
  } catch {
    cached = null;
  }
  return cached;
}

/** Synchronous read for the API client; valid after loadServerUrl() ran at startup. */
export function getServerUrl(): string | null {
  return cached;
}

export async function setServerUrl(url: string | null): Promise<void> {
  const clean = url?.trim().replace(/\/+$/, '') || null;
  cached = clean;
  if (clean) await AsyncStorage.setItem(KEY, clean);
  else await AsyncStorage.removeItem(KEY);
}

/** Probe a candidate server; resolves true only if /health answers ok. */
export async function checkServer(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.trim().replace(/\/+$/, '')}/health`);
    if (!res.ok) return false;
    const body = await res.json();
    return body?.ok === true;
  } catch {
    return false;
  }
}
