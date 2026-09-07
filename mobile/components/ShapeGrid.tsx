import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from './theme';

/**
 * Live view of a declared room grid during a scan: W×H boxes, colored as
 * their cells get measured, with the phone's mapped position and a coverage
 * count. This is the "fill out the grid" experience — the raw trail stays
 * out of sight; the declared rectangle IS the display.
 */

type Props = {
  w: number;
  h: number;
  /** "dx,dz" → heatmap color for boxes that have measurements. */
  colors: Map<string, string>;
  /** Phone's current position mapped into the grid, if known. */
  dot?: { dx: number; dz: number } | null;
};

export default function ShapeGrid({ w, h, colors, dot }: Props) {
  const { theme } = useTheme();
  const cellPx = Math.max(10, Math.min(26, Math.floor(300 / w), Math.floor(150 / h)));
  const covered = colors.size;
  const total = w * h;

  const boxes = [];
  for (let dz = 0; dz < h; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const color = colors.get(`${dx},${dz}`);
      boxes.push(
        <View
          key={`${dx},${dz}`}
          style={{
            position: 'absolute',
            left: dx * cellPx,
            top: dz * cellPx,
            width: cellPx - 1,
            height: cellPx - 1,
            borderRadius: 2,
            backgroundColor: color ?? theme.inputBg,
            borderWidth: color ? 0 : StyleSheet.hairlineWidth,
            borderColor: theme.border,
          }}
        />
      );
    }
  }

  return (
    <View style={styles.container}>
      <View style={{ width: w * cellPx, height: h * cellPx }}>
        {boxes}
        {dot && (
          <View
            style={[
              styles.dot,
              {
                left: dot.dx * cellPx + cellPx / 2 - 5,
                top: dot.dz * cellPx + cellPx / 2 - 5,
                borderColor: theme.card,
              },
            ]}
          />
        )}
      </View>
      <Text style={[styles.coverage, { color: covered === total ? '#22C55E' : theme.muted }]}>
        {covered === total ? '✓ Grid fully covered' : `Coverage: ${covered}/${total} boxes`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34D399',
    borderWidth: 2,
  },
  coverage: {
    fontSize: 12,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
});
