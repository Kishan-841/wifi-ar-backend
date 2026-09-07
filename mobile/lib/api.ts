import { NativeModules } from 'react-native';

import type { Measurement } from './measurement';

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

export type UploadResult = { id: string; measurementCount: number };

export type ScanSummary = {
  id: string;
  startedAt: string;
  endedAt: string;
  ssid: string | null;
  measurementCount: number;
};

export type ScanDetail = {
  id: string;
  startedAt: string;
  endedAt: string;
  ssid: string | null;
  measurements: Measurement[];
};

export type Placement = { scanId: string; col: number; row: number; rotation: number };

export type Layout = {
  id: string;
  name: string;
  cols: number;
  rows: number;
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
  const response = await fetch(`http://${apiHost()}:${API_PORT}/api/layouts`);
  if (!response.ok) throw new Error(`layouts list failed (HTTP ${response.status})`);
  return response.json();
}

export async function getLayout(id: string): Promise<Layout> {
  const response = await fetch(`http://${apiHost()}:${API_PORT}/api/layouts/${id}`);
  if (!response.ok) throw new Error(`layout fetch failed (HTTP ${response.status})`);
  return response.json();
}

export async function createLayout(name: string, cols: number, rows: number): Promise<Layout> {
  const response = await fetch(`http://${apiHost()}:${API_PORT}/api/layouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, cols, rows }),
  });
  if (!response.ok) throw new Error(`layout create failed (HTTP ${response.status})`);
  return { ...(await response.json()), placements: [] };
}

export async function saveLayout(
  id: string,
  update: { cols?: number; rows?: number; placements: Placement[] }
): Promise<Layout> {
  const response = await fetch(`http://${apiHost()}:${API_PORT}/api/layouts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw new Error(`layout save failed (HTTP ${response.status})`);
  return response.json();
}

export async function listScans(): Promise<ScanSummary[]> {
  const response = await fetch(`http://${apiHost()}:${API_PORT}/api/scans`);
  if (!response.ok) throw new Error(`list failed (HTTP ${response.status})`);
  return response.json();
}

export async function getScan(id: string): Promise<ScanDetail> {
  const response = await fetch(`http://${apiHost()}:${API_PORT}/api/scans/${id}`);
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
  measurements: Measurement[];
}): Promise<UploadResult> {
  const response = await fetch(`http://${apiHost()}:${API_PORT}/api/scans`, {
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
