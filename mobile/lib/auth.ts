import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Session on the phone: the bearer token + the logged-in user, persisted.
 * lib/api.ts attaches the token to every request and calls clearSession()
 * on a 401, which flips the app back to the login screen.
 */
export type AuthUser = { id: string; name: string; email: string; role: 'admin' | 'user' };

const TOKEN_KEY = 'wifiar.token';
const USER_KEY = 'wifiar.user';

let token: string | null = null;
let user: AuthUser | null = null;
const listeners = new Set<() => void>();

export function getToken(): string | null {
  return token;
}

export function getUser(): AuthUser | null {
  return user;
}

export function onAuthChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

export async function loadSession(): Promise<void> {
  try {
    token = await AsyncStorage.getItem(TOKEN_KEY);
    const raw = await AsyncStorage.getItem(USER_KEY);
    user = raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    token = null;
    user = null;
  }
}

export async function setSession(t: string, u: AuthUser): Promise<void> {
  token = t;
  user = u;
  await AsyncStorage.multiSet([
    [TOKEN_KEY, t],
    [USER_KEY, JSON.stringify(u)],
  ]);
  notify();
}

export async function clearSession(): Promise<void> {
  token = null;
  user = null;
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  notify();
}
