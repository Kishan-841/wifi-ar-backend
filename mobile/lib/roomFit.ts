import type { Measurement } from './measurement';
import { rssiToColor } from './heatmapColor';
import type { PieceCell, RoomPiece } from './roomPiece';

const CELL = 0.5;

/**
 * Fit a noisy walked trail into the user-declared W×H rectangle.
 *
 * Why: a scan colors the PATH, not the floor — and the AR axes point wherever
 * the phone faced at scan start, so straight walls come out as diagonals
 * (verified on the real "Bedroom 2" dataset). The user knows the truth
 * ("rectangle, 8×6 boxes"); this bends the data to it in three steps:
 *
 * 1. De-skew: find the rotation (0–89°) that makes the trail's bounding box
 *    tightest — that aligns the walk with the room's walls.
 * 2. Stretch: map the trail's bounding box proportionally onto W×H cells.
 * 3. Fill: unmeasured cells inherit the RSSI of their nearest measured cell,
 *    flagged `interpolated` so rendering can show them slightly translucent.
 */
export type FitParams = {
  cos: number;
  sin: number;
  swap: boolean;
  ox: number;
  oz: number;
  nx: number;
  nz: number;
  w: number;
  h: number;
};

/** Compute the trail→rectangle mapping (de-skew rotation + bbox stretch). */
export function computeFit(pts: { x: number; z: number }[], w: number, h: number): FitParams {
  // 1 — de-skew: brute-force the tightest bounding box.
  let bestAngle = 0;
  let bestArea = Infinity;
  for (let deg = 0; deg < 90; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of pts) {
      const x = p.x * cos - p.z * sin;
      const z = p.x * sin + p.z * cos;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const area = (maxX - minX) * (maxZ - minZ);
    if (area < bestArea) {
      bestArea = area;
      bestAngle = rad;
    }
  }
  const cos = Math.cos(bestAngle);
  const sin = Math.sin(bestAngle);
  const rotated = pts.map((p) => ({
    x: p.x * cos - p.z * sin,
    z: p.x * sin + p.z * cos,
  }));

  // Orient the data's long side to the declared long side.
  const minX = Math.min(...rotated.map((p) => p.x));
  const maxX = Math.max(...rotated.map((p) => p.x));
  const minZ = Math.min(...rotated.map((p) => p.z));
  const maxZ = Math.max(...rotated.map((p) => p.z));
  const dataWide = maxX - minX >= maxZ - minZ;
  const targetWide = w >= h;
  const swap = dataWide !== targetWide;

  return {
    cos,
    sin,
    swap,
    ox: swap ? minZ : minX,
    oz: swap ? minX : minZ,
    nx: swap ? maxZ - minZ : maxX - minX,
    nz: swap ? maxX - minX : maxZ - minZ,
    w,
    h,
  };
}

/** Map one AR point into a declared-grid box via a computed fit. */
export function applyFit(x: number, z: number, f: FitParams): { dx: number; dz: number } {
  const rx = x * f.cos - z * f.sin;
  const rz = x * f.sin + z * f.cos;
  const px = f.swap ? rz : rx;
  const pz = f.swap ? rx : rz;
  const dx = f.nx < CELL ? 0 : Math.max(0, Math.min(f.w - 1, Math.round(((px - f.ox) / f.nx) * (f.w - 1))));
  const dz = f.nz < CELL ? 0 : Math.max(0, Math.min(f.h - 1, Math.round(((pz - f.oz) / f.nz) * (f.h - 1))));
  return { dx, dz };
}

export function fitPieceToRect(
  measurements: Measurement[],
  w: number,
  h: number,
  scanId: string,
  name: string
): RoomPiece {
  const fit = computeFit(measurements, w, h);

  const values = new Map<string, number[]>();
  for (const m of measurements) {
    const { dx, dz } = applyFit(m.x, m.z, fit);
    const key = `${dx},${dz}`;
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

  // 3 — nearest-neighbor fill for the full rectangle.
  const cells: PieceCell[] = [];
  for (let dz = 0; dz < h; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const hit = measured.find((c) => c.dx === dx && c.dz === dz);
      if (hit) {
        cells.push({ dx, dz, color: rssiToColor(hit.rssi), interpolated: false });
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
