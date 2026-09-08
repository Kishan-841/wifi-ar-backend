import { NativeModules } from 'react-native';

import { AuthUser, clearSession, getToken, setSession } from './auth';
import type { Measurement } from './measurement';
import { getServerUrl } from './settings';

/**
 * In development the backend runs on the same machine as Metro. The app
 * already knows Metro's address — it loaded its own JS bundle from it
 * (NativeModules.SourceCode.scriptURL). Deriving the API host from that
 * makes the app immune to the Mac's wandering DHCP address.
 *
 * A production build has no Metro; it will need a real configured URL
 * (that's a Phase 10 concern — HTTPS, a domain, the VM).
 */
function apiHost(): string {
  const scriptUrl: string | undefined = NativeModules?.SourceCode?.scriptURL;
  const match = scriptUrl?.match(/\/\/([^:/]+)[:/]/);
  return match ? match[1] : 'localhost';
}

const API_PORT = 4000;

/**
 * Release builds have no Metro to derive the host from, so the APK bakes in
 * EXPO_PUBLIC_API_URL at build time (tools/build-apk.sh sets it). Dev builds
 * leave it unset and keep the DHCP-proof derivation.
 */
export function apiBase(): string {
  return (
    getServerUrl() ?? process.env.EXPO_PUBLIC_API_URL ?? `http://${apiHost()}:${API_PORT}`
  );
}

/** fetch with the session token; a 401 ends the session (→ login screen). */
async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${apiBase()}${path}`, { ...init, headers });
  if (response.status === 401) {
    await clearSession();
    throw new Error('Session expired — please log in again');
  }
  return response;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${apiBase()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `login failed (HTTP ${response.status})`);
  }
  const data = await response.json();
  await setSession(data.token, data.user);
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await authed('/api/auth/logout', { method: 'POST' });
  } catch {
    // Local session is cleared regardless.
  }
  await clearSession();
}

export type UploadResult = { id: string; measurementCount: number };

export type ScanSummary = {
  id: string;
  startedAt: string;
  endedAt: string;
  ssid: string | null;
  shapeW: number | null;
  shapeH: number | null;
  room: string | null;
  measurementCount: number;
};

export type ScanDetail = {
  id: string;
  startedAt: string;
  endedAt: string;
  ssid: string | null;
  shapeW: number | null;
  shapeH: number | null;
  measurements: Measurement[];
};

export type Placement = { scanId: string; col: number; row: number; rotation: number };

export type Layout = {
  id: string;
  name: string;
  cols: number;
  rows: number;
  routerCol: number | null;
  routerRow: number | null;
  placements: Placement[];
};

export type LayoutSummary = {
  id: string;
  name: string;
  cols: number;
  rows: number;
  placementCount: number;
};

export async function listLayouts(): Promise<LayoutSummary[]> {
  const response = await authed('/api/layouts');
  if (!response.ok) throw new Error(`layouts list failed (HTTP ${response.status})`);
  return response.json();
}

export async function getLayout(id: string): Promise<Layout> {
  const response = await authed(`/api/layouts/${id}`);
  if (!response.ok) throw new Error(`layout fetch failed (HTTP ${response.status})`);
  return response.json();
}

export async function createLayout(name: string, cols: number, rows: number): Promise<Layout> {
  const response = await authed('/api/layouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, cols, rows }),
  });
  if (!response.ok) throw new Error(`layout create failed (HTTP ${response.status})`);
  return { routerCol: null, routerRow: null, ...(await response.json()), placements: [] };
}

export async function saveLayout(
  id: string,
  update: {
    name?: string;
    cols?: number;
    rows?: number;
    routerCol?: number | null;
    routerRow?: number | null;
    placements: Placement[];
  }
): Promise<Layout> {
  const response = await authed(`/api/layouts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw new Error(`layout save failed (HTTP ${response.status})`);
  return response.json();
}

export async function deleteLayout(id: string): Promise<void> {
  const response = await authed(`/api/layouts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`delete failed (HTTP ${response.status})`);
}

export async function deleteScan(id: string): Promise<void> {
  const response = await authed(`/api/scans/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`delete failed (HTTP ${response.status})`);
}

export async function listScans(): Promise<ScanSummary[]> {
  const response = await authed('/api/scans');
  if (!response.ok) throw new Error(`list failed (HTTP ${response.status})`);
  return response.json();
}

export async function getScan(id: string): Promise<ScanDetail> {
  const response = await authed(`/api/scans/${id}`);
  if (!response.ok) throw new Error(`fetch failed (HTTP ${response.status})`);
  const raw = await response.json();
  return {
    ...raw,
    // The server stores timestamps as dates (ISO strings on the wire); the
    // app's Measurement type uses epoch ms — convert once, at the boundary.
    measurements: raw.measurements.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp).getTime(),
    })),
  };
}

export async function uploadScan(input: {
  startedAt: number;
  endedAt: number;
  ssid: string | null;
  shapeW?: number | null;
  shapeH?: number | null;
  measurements: Measurement[];
}): Promise<UploadResult> {
  const response = await authed('/api/scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`upload failed (HTTP ${response.status}): ${body.slice(0, 200)}`);
  }
  return response.json();
}

// ---------- admin (role = admin only; the API enforces it) ----------

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  scanCount: number;
  layoutCount: number;
};

export type AdminScanSummary = ScanSummary & {
  createdAt: string;
  user: { id: string; name: string; email: string };
};

export type AdminScanDetail = ScanDetail & { user: { id: string; name: string; email: string } };

async function expectOk(response: Response, what: string): Promise<any> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `${what} failed (HTTP ${response.status})`);
  }
  return response.json();
}

export async function adminListUsers(): Promise<AdminUser[]> {
  return expectOk(await authed('/api/admin/users'), 'users list');
}

export async function adminCreateUser(name: string, email: string, password: string): Promise<AdminUser> {
  return expectOk(
    await authed('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email: email.trim().toLowerCase(), password }),
    }),
    'create user'
  );
}

export async function adminDeleteUser(id: string): Promise<void> {
  await expectOk(await authed(`/api/admin/users/${id}`, { method: 'DELETE' }), 'delete user');
}

export async function adminListScans(): Promise<AdminScanSummary[]> {
  return expectOk(await authed('/api/admin/scans'), 'recordings list');
}

export async function adminGetScan(id: string): Promise<AdminScanDetail> {
  const raw = await expectOk(await authed(`/api/admin/scans/${id}`), 'recording');
  return {
    ...raw,
    measurements: raw.measurements.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp).getTime() })),
  };
}
