import type { ScanDetail } from './api';
import { GridCell, addToGrid, cellKey } from './grid';
import { rssiToColor } from './heatmapColor';

/**
 * A room scan turned into a puzzle piece: its walked cells, normalized so the
 * top-left of its bounding box is (0,0). Colors are baked from per-cell median
 * RSSI. Internally cells are still 0.5 m — pieces are mutually to-scale even
 * though the board UI never mentions units.
 */

export type PieceCell = {
  dx: number;
  dz: number;
  color: string;
  /** True when the cell's value was filled from a neighbor, not measured. */
  interpolated?: boolean;
};

export type RoomPiece = {
  scanId: string;
  name: string;
  w: number;
  h: number;
  cells: PieceCell[];
};

/** Most common room tag in a scan, else null. */
export function roomNameOf(scan: ScanDetail): string | null {
  const counts = new Map<string, number>();
  for (const m of scan.measurements) {
    if (m.room) counts.set(m.room, (counts.get(m.room) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function buildPiece(scan: ScanDetail): RoomPiece {
  const grid = new Map<string, GridCell>();
  for (const m of scan.measurements) addToGrid(grid, m);
  const cells = Array.from(grid.values());

  const minCx = Math.min(...cells.map((c) => c.cx));
  const minCz = Math.min(...cells.map((c) => c.cz));
  const maxCx = Math.max(...cells.map((c) => c.cx));
  const maxCz = Math.max(...cells.map((c) => c.cz));

  const topRoom = roomNameOf(scan);

  return {
    scanId: scan.id,
    name: topRoom ?? scan.ssid ?? 'Room',
    w: maxCx - minCx + 1,
    h: maxCz - minCz + 1,
    cells: cells.map((c) => ({
      dx: c.cx - minCx,
      dz: c.cz - minCz,
      color: rssiToColor(c.medianRssi),
    })),
  };
}

/** Piece cells after `rotation` quarter turns clockwise (0-3). */
export function rotatedCells(piece: RoomPiece, rotation: number): PieceCell[] {
  const r = ((rotation % 4) + 4) % 4;
  return piece.cells.map((c) => {
    switch (r) {
      case 1:
        return { ...c, dx: piece.h - 1 - c.dz, dz: c.dx };
      case 2:
        return { ...c, dx: piece.w - 1 - c.dx, dz: piece.h - 1 - c.dz };
      case 3:
        return { ...c, dx: c.dz, dz: piece.w - 1 - c.dx };
      default:
        return c;
    }
  });
}

/** Width/height of the piece's bounding box after rotation. */
export function rotatedSize(piece: RoomPiece, rotation: number): { w: number; h: number } {
  return rotation % 2 === 0 ? { w: piece.w, h: piece.h } : { w: piece.h, h: piece.w };
}

/**
 * Which edges of each cell are exposed (no neighbor cell in the same piece) —
 * these edges get the room border stroke.
 */
export function exposedEdges(
  cells: PieceCell[]
): { cell: PieceCell; top: boolean; bottom: boolean; left: boolean; right: boolean }[] {
  const occupied = new Set(cells.map((c) => `${c.dx},${c.dz}`));
  return cells.map((cell) => ({
    cell,
    top: !occupied.has(`${cell.dx},${cell.dz - 1}`),
    bottom: !occupied.has(`${cell.dx},${cell.dz + 1}`),
    left: !occupied.has(`${cell.dx - 1},${cell.dz}`),
    right: !occupied.has(`${cell.dx + 1},${cell.dz}`),
  }));
}

export { cellKey };
