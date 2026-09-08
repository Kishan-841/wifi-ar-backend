import { cookies } from 'next/headers';

// Server-side API client. Every call carries the session token from the
// httpOnly cookie; the API enforces ownership, the dashboard just displays.
const API_URL = process.env.API_URL ?? 'http://localhost:4000';
export const COOKIE = 'wifiar_token';

export type SessionUser = { id: string; name: string; email: string; role: 'admin' | 'user' };
export type Owner = { id: string; name: string; email: string };

export type ScanSummary = {
  id: string;
  startedAt: string;
  endedAt: string;
  createdAt?: string;
  ssid: string | null;
  shapeW: number | null;
  shapeH: number | null;
  room: string | null;
  measurementCount: number;
  user?: Owner;
};

export type Measurement = {
  timestamp: string;
  x: number;
  y: number;
  z: number;
  rssi: number;
  ssid: string;
  bssid: string;
  frequency: number;
  trackingQuality: string;
  room: string | null;
};

export type ScanDetail = {
  id: string;
  startedAt: string;
  endedAt: string;
  ssid: string | null;
  shapeW: number | null;
  shapeH: number | null;
  measurements: Measurement[];
  user?: Owner;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  scanCount: number;
  layoutCount: number;
};

export async function api(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' });
}

/** The logged-in user for this request, or null (no/expired cookie). */
export async function getSession(): Promise<{ token: string; user: SessionUser } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await api('/api/auth/me', token);
    if (!res.ok) return null;
    return { token, user: await res.json() };
  } catch {
    return null;
  }
}

export async function fetchScans(session: { token: string; user: SessionUser }): Promise<ScanSummary[]> {
  const path = session.user.role === 'admin' ? '/api/admin/scans' : '/api/scans';
  const res = await api(path, session.token);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function fetchScan(
  session: { token: string; user: SessionUser },
  id: string
): Promise<ScanDetail | null> {
  const path = session.user.role === 'admin' ? `/api/admin/scans/${id}` : `/api/scans/${id}`;
  const res = await api(path, session.token);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function fetchUsers(token: string): Promise<AdminUser[]> {
  const res = await api('/api/admin/users', token);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
