// Server-side API client. The dashboard never touches PostgreSQL directly —
// it goes through the same Express API as the phone (one door, one set of rules).
// API_URL is localhost while the backend lives on this Mac; it becomes the VM's
// public URL at deployment time without any page code changing.

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export type ScanSummary = {
  id: string;
  startedAt: string;
  endedAt: string;
  ssid: string | null;
  measurementCount: number;
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
  measurements: Measurement[];
};

export async function fetchScans(): Promise<ScanSummary[]> {
  const res = await fetch(`${API_URL}/api/scans`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function fetchScan(id: string): Promise<ScanDetail | null> {
  const res = await fetch(`${API_URL}/api/scans/${id}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
