// Heatmap math for the browser. The band thresholds/colors MUST stay in sync
// with mobile/lib/heatmapColor.ts (single conceptual source of truth; two apps,
// no shared package yet — revisit if a third consumer appears).

import type { Measurement } from './scans';

export const CELL_SIZE_M = 0.5; // keep in sync with mobile/lib/grid.ts

export const RSSI_BANDS = [
  { min: -50, color: '#2e7d32', label: 'Excellent' },
  { min: -58, color: '#7cb342', label: 'Good' },
  { min: -66, color: '#fdd835', label: 'Fair' },
  { min: -74, color: '#fb8c00', label: 'Weak' },
  { min: -82, color: '#e53935', label: 'Poor' },
  { min: -Infinity, color: '#7b1a1a', label: 'Unusable' },
];

export function rssiToColor(rssi: number): string {
  return (RSSI_BANDS.find((b) => rssi >= b.min) ?? RSSI_BANDS[RSSI_BANDS.length - 1]).color;
}

export type Cell = {
  cx: number;
  cz: number;
  medianRssi: number;
  n: number;
  room: string | null;
};

export function buildGrid(measurements: Measurement[]): Cell[] {
  const byKey = new Map<string, { cx: number; cz: number; values: number[]; room: string | null }>();
  for (const m of measurements) {
    const cx = Math.round(m.x / CELL_SIZE_M);
    const cz = Math.round(m.z / CELL_SIZE_M);
    const key = `${cx},${cz}`;
    const cell = byKey.get(key) ?? { cx, cz, values: [], room: null };
    cell.values.push(m.rssi);
    if (m.room != null) cell.room = m.room;
    byKey.set(key, cell);
  }
  return Array.from(byKey.values()).map((c) => {
    const sorted = [...c.values].sort((a, b) => a - b);
    return {
      cx: c.cx,
      cz: c.cz,
      medianRssi: sorted[Math.floor(sorted.length / 2)],
      n: c.values.length,
      room: c.room,
    };
  });
}

export type RoomStats = {
  room: string;
  points: number;
  medianRssi: number;
  minRssi: number;
  maxRssi: number;
};

export function summarizeRooms(measurements: Measurement[]): RoomStats[] {
  const byRoom = new Map<string, number[]>();
  for (const m of measurements) {
    const key = m.room ?? '(untagged)';
    const list = byRoom.get(key) ?? [];
    list.push(m.rssi);
    byRoom.set(key, list);
  }
  return Array.from(byRoom.entries()).map(([room, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      room,
      points: sorted.length,
      medianRssi: sorted[Math.floor(sorted.length / 2)],
      minRssi: sorted[0],
      maxRssi: sorted[sorted.length - 1],
    };
  });
}
