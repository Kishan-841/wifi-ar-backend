import type { Measurement } from './measurement';

/**
 * Spatial grid: collapses many measurements into per-cell statistics.
 *
 * The room floor (x/z plane — y is height) is divided into square cells.
 * Standing in one spot refines that cell's statistics instead of appending
 * duplicate points. This is the data structure the Phase 5 heatmap will draw.
 */

/** Cell edge length in meters. Tunable: smaller = finer map, noisier cells. */
export const CELL_SIZE_M = 0.5;

export type GridCell = {
  /** Cell indices (not meters) — multiply by CELL_SIZE_M for position. */
  cx: number;
  cz: number;
  /** All RSSI values recorded in this cell (median computed on demand). */
  rssiValues: number[];
  medianRssi: number;
  minRssi: number;
  maxRssi: number;
  /** How many of the contributing measurements were 'suspect' tracking. */
  suspectCount: number;
  /** Room tag of the most recent contributing measurement. */
  room: string | null;
  lastUpdated: number;
};

export function cellKey(x: number, z: number): string {
  return `${Math.round(x / CELL_SIZE_M)},${Math.round(z / CELL_SIZE_M)}`;
}

export function addToGrid(grid: Map<string, GridCell>, m: Measurement): GridCell {
  const key = cellKey(m.x, m.z);
  let cell = grid.get(key);
  if (!cell) {
    cell = {
      cx: Math.round(m.x / CELL_SIZE_M),
      cz: Math.round(m.z / CELL_SIZE_M),
      rssiValues: [],
      medianRssi: m.rssi,
      minRssi: m.rssi,
      maxRssi: m.rssi,
      suspectCount: 0,
      room: null,
      lastUpdated: m.timestamp,
    };
    grid.set(key, cell);
  }
  if (m.room != null) cell.room = m.room;
  cell.rssiValues.push(m.rssi);
  const sorted = [...cell.rssiValues].sort((a, b) => a - b);
  cell.medianRssi = sorted[Math.floor(sorted.length / 2)];
  cell.minRssi = sorted[0];
  cell.maxRssi = sorted[sorted.length - 1];
  if (m.trackingQuality !== 'TRACKING') cell.suspectCount += 1;
  cell.lastUpdated = m.timestamp;
  return cell;
}

export type GridSummary = {
  cells: number;
  totalPoints: number;
  strongest: number | null;
  weakest: number | null;
  /** Largest in-cell spread — a proxy for how noisy the scan is. */
  worstCellSpread: number;
};

export function summarizeGrid(grid: Map<string, GridCell>): GridSummary {
  let strongest: number | null = null;
  let weakest: number | null = null;
  let worstCellSpread = 0;
  let totalPoints = 0;
  for (const cell of grid.values()) {
    totalPoints += cell.rssiValues.length;
    if (strongest == null || cell.medianRssi > strongest) strongest = cell.medianRssi;
    if (weakest == null || cell.medianRssi < weakest) weakest = cell.medianRssi;
    worstCellSpread = Math.max(worstCellSpread, cell.maxRssi - cell.minRssi);
  }
  return { cells: grid.size, totalPoints, strongest, weakest, worstCellSpread };
}
