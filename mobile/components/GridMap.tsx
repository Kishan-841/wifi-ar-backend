import { StyleSheet, Text, View } from 'react-native';

import type { GridCell } from '../lib/grid';
import { CELL_SIZE_M } from '../lib/grid';
import { RSSI_BANDS, rssiToColor } from '../lib/heatmapColor';
import type { Pose } from './ArPoseSource';
import { useTheme } from './theme';

/**
 * Top-down 2D map of the scanned grid. Plain colored Views — deliberately no
 * SVG/canvas dependency (those are native deps → rebuild) for what is,
 * at this phase, colored squares.
 *
 * Orientation: this is the AR session's x/z plane seen from above. The origin
 * (scan start) is wherever the scan began; the map is relative to the room,
 * not to compass north.
 */

type Props = {
  cells: GridCell[];
  /** Live phone position, drawn as a blue dot. */
  currentPose?: Pose | null;
  /** Rendered height of the map area in px. */
  height: number;
  showLegend?: boolean;
};

const MAX_CELL_PX = 36;
const MIN_CELL_PX = 10;

/** Average cell position per room — where the room's name is drawn on the map. */
function roomCentroids(cells: GridCell[]): { room: string; cx: number; cz: number }[] {
  const byRoom = new Map<string, { sx: number; sz: number; n: number }>();
  for (const c of cells) {
    if (c.room == null) continue;
    const acc = byRoom.get(c.room) ?? { sx: 0, sz: 0, n: 0 };
    acc.sx += c.cx;
    acc.sz += c.cz;
    acc.n += 1;
    byRoom.set(c.room, acc);
  }
  return Array.from(byRoom.entries()).map(([room, a]) => ({
    room,
    cx: a.sx / a.n,
    cz: a.sz / a.n,
  }));
}

export default function GridMap({ cells, currentPose, height, showLegend }: Props) {
  const { theme } = useTheme();
  if (cells.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={[styles.emptyText, { color: theme.muted }]}>No cells yet — walk around while scanning.</Text>
      </View>
    );
  }

  let minCx = Infinity;
  let maxCx = -Infinity;
  let minCz = Infinity;
  let maxCz = -Infinity;
  for (const c of cells) {
    if (c.cx < minCx) minCx = c.cx;
    if (c.cx > maxCx) maxCx = c.cx;
    if (c.cz < minCz) minCz = c.cz;
    if (c.cz > maxCz) maxCz = c.cz;
  }
  // Include the live position in the bounds so the dot never renders off-map.
  if (currentPose) {
    const pcx = Math.round(currentPose.x / CELL_SIZE_M);
    const pcz = Math.round(currentPose.z / CELL_SIZE_M);
    if (pcx < minCx) minCx = pcx;
    if (pcx > maxCx) maxCx = pcx;
    if (pcz < minCz) minCz = pcz;
    if (pcz > maxCz) maxCz = pcz;
  }

  const nx = maxCx - minCx + 1;
  const nz = maxCz - minCz + 1;
  const legendSpace = showLegend ? 22 : 0;
  const cellPx = Math.max(
    MIN_CELL_PX,
    Math.min(MAX_CELL_PX, Math.floor((height - legendSpace - 8) / nz), Math.floor(320 / nx))
  );

  return (
    <View style={[styles.container, { height }]}>
      <View style={{ width: nx * cellPx, height: nz * cellPx }}>
        {cells.map((c) => (
          <View
            key={`${c.cx},${c.cz}`}
            style={{
              position: 'absolute',
              left: (c.cx - minCx) * cellPx,
              top: (c.cz - minCz) * cellPx,
              width: cellPx - 1,
              height: cellPx - 1,
              backgroundColor: rssiToColor(c.medianRssi),
              borderRadius: 2,
              opacity: c.suspectCount > c.rssiValues.length / 2 ? 0.45 : 1,
            }}
          />
        ))}
        {showLegend &&
          roomCentroids(cells).map((r) => (
            <Text
              key={r.room}
              style={[
                styles.roomLabel,
                {
                  left: (r.cx - minCx) * cellPx - 30,
                  top: (r.cz - minCz) * cellPx - 7,
                },
              ]}
              numberOfLines={1}
            >
              {r.room}
            </Text>
          ))}
        {currentPose && (
          <View
            style={[
              styles.positionDot,
              {
                left: (currentPose.x / CELL_SIZE_M - minCx) * cellPx + cellPx / 2 - 5,
                top: (currentPose.z / CELL_SIZE_M - minCz) * cellPx + cellPx / 2 - 5,
              },
            ]}
          />
        )}
      </View>
      {showLegend && (
        <View style={styles.legend}>
          {RSSI_BANDS.slice(0, 5).map((b) => (
            <View key={b.label} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: b.color }]} />
              <Text style={[styles.legendText, { color: theme.muted }]}>{b.min > -100 ? `≥${b.min}` : '<−82'}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
  },
  roomLabel: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textShadowColor: '#000000',
    textShadowRadius: 3,
  },
  positionDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7c5cd6',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  legend: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
});
