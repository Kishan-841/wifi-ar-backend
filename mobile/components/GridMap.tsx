import { StyleSheet, Text, View } from 'react-native';

import type { GridCell } from '../lib/grid';
import { CELL_SIZE_M } from '../lib/grid';
import { RSSI_BANDS, rssiToColor } from '../lib/heatmapColor';
import type { Pose } from './ArPoseSource';

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

export default function GridMap({ cells, currentPose, height, showLegend }: Props) {
  if (cells.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>No cells yet — walk around while scanning.</Text>
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
              <Text style={styles.legendText}>{b.min > -100 ? `≥${b.min}` : '<−82'}</Text>
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
    color: '#546e7a',
    fontSize: 12,
  },
  positionDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#29b6f6',
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
    color: '#90a4ae',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
});
