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
