import type { Measurement } from './measurement';
import { rssiToColor } from './heatmapColor';
import type { PieceCell, RoomPiece } from './roomPiece';

const CELL = 0.5;

/**
 * FIXED room grid ("litter box" model): the declared W×H boxes occupy a fixed
 * physical area anchored at the scan's starting point. The user starts in a
 * corner facing the far wall; the grid extends forward (rows) and to the
 * right (columns). Readings outside the grid are DISCARDED — the mapping
 * never stretches or rotates to chase the trail.
 *
 * AR frame at session start: origin = phone, -Z = forward, +X = right.
 * Box (0,0) is centered on the starting point (±half a box of tolerance).
 */

/**
 * Map an AR position to its grid box. A point up to DRIFT_MARGIN boxes outside
 * clamps to the nearest edge box (mild AR drift shouldn't lose readings);
 * anything farther out returns null and is discarded.
 */
const DRIFT_MARGIN = 1;

export function fixedGridBox(
  x: number,
  z: number,
  w: number,
  h: number
): { dx: number; dz: number } | null {
  const dx = Math.round(x / CELL);
  const dz = Math.round(-z / CELL);
  if (dx < -DRIFT_MARGIN || dx >= w + DRIFT_MARGIN) return null;
  if (dz < -DRIFT_MARGIN || dz >= h + DRIFT_MARGIN) return null;
  return {
    dx: Math.max(0, Math.min(w - 1, dx)),
    dz: Math.max(0, Math.min(h - 1, dz)),
  };
}

/**
 * Build the room piece for a fixed-grid scan: median RSSI per covered box,
 * then fill uncovered boxes from their nearest measured neighbor
 * (flagged `interpolated`, rendered translucent).
 */
export function fixedRectPiece(
  measurements: Measurement[],
  w: number,
  h: number,
  scanId: string,
  name: string
): RoomPiece {
  const values = new Map<string, number[]>();
  for (const m of measurements) {
    const box = fixedGridBox(m.x, m.z, w, h);
    if (!box) continue; // outside the grid — discarded
    const key = `${box.dx},${box.dz}`;
    const list = values.get(key) ?? [];
    list.push(m.rssi);
    values.set(key, list);
  }

  const measured: { dx: number; dz: number; rssi: number }[] = [];
  for (const [key, list] of values) {
    const [dx, dz] = key.split(',').map(Number);
    const sorted = [...list].sort((a, b) => a - b);
    measured.push({ dx, dz, rssi: sorted[Math.floor(sorted.length / 2)] });
  }

  const cells: PieceCell[] = [];
  for (let dz = 0; dz < h; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const hit = measured.find((c) => c.dx === dx && c.dz === dz);
      if (hit) {
        cells.push({ dx, dz, color: rssiToColor(hit.rssi), interpolated: false });
        continue;
      }
      if (measured.length === 0) {
        cells.push({ dx, dz, color: rssiToColor(-127), interpolated: true });
        continue;
      }
      let best = measured[0];
      let bestDist = Infinity;
      for (const c of measured) {
        const d = (c.dx - dx) ** 2 + (c.dz - dz) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      cells.push({ dx, dz, color: rssiToColor(best.rssi), interpolated: true });
    }
  }

  return { scanId, name, w, h, cells };
}
