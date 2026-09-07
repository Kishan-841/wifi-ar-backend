/**
 * Guided grid survey: the structured walk PROVIDES the position; AR only
 * assists. Professional survey tools (NetSpot, Ekahau) have the user declare
 * where they are; ARCore drifts ~14 cm per meter walked, so we let the
 * walking order define rows/columns and reset AR at every recorded box.
 */

export type Box = { dx: number; dz: number };

export const boxKey = (b: Box) => `${b.dx},${b.dz}`;

/** Lawnmower order: row 0 left→right, row 1 right→left, … */
export function serpentineOrder(w: number, h: number): Box[] {
  const order: Box[] = [];
  for (let dz = 0; dz < h; dz++) {
    for (let i = 0; i < w; i++) {
      const dx = dz % 2 === 0 ? i : w - 1 - i;
      order.push({ dx, dz });
    }
  }
  return order;
}

/** Human hint for moving from one box to the next. */
export function moveHint(from: Box | null, to: Box): string {
  if (!from) return 'Stand in the corner box to begin';
  if (to.dz !== from.dz) return 'Step forward one box (next row)';
  if (to.dx > from.dx) return 'Step right one box';
  if (to.dx < from.dx) return 'Step left one box';
  return 'Stay here';
}

/** Cell size in meters — must match lib/grid.ts. */
export const CELL_M = 0.5;
/** How far AR must see you move before suggesting the next box. */
export const STEP_DISTANCE_M = 0.35;
/** Movement over the last second below this counts as "standing still". */
export const STILL_THRESHOLD_M = 0.08;
/** Seconds of Wi-Fi sampling per box. */
export const SAMPLE_SECONDS = 1.5;
