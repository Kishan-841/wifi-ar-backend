import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from './theme';

/**
 * The room grid during a guided survey: W×H boxes — recorded ones colored,
 * skipped ones marked, the target box highlighted. Tap any box to jump there.
 */

type Props = {
  w: number;
  h: number;
  /** "dx,dz" → heatmap color for recorded boxes. */
  colors: Map<string, string>;
  skipped?: Set<string>;
  /** The box the user should stand in next. */
  target?: { dx: number; dz: number } | null;
  onBoxPress?: (dx: number, dz: number) => void;
  /** Space the grid may occupy; boxes shrink to fit (never overflow). */
  maxWidth?: number;
  maxHeight?: number;
};

export default function ShapeGrid({
  w,
  h,
  colors,
  skipped,
  target,
  onBoxPress,
  maxWidth = 300,
  maxHeight = 170,
}: Props) {
  const { theme } = useTheme();
  // Fit first, then clamp: a 60-box side gets tiny cells rather than a grid
  // that runs off the screen.
  const cellPx = Math.max(4, Math.min(30, Math.floor(maxWidth / w), Math.floor(maxHeight / h)));
  const recorded = colors.size;
  const skippedCount = skipped?.size ?? 0;
  const total = w * h;
  const complete = recorded + skippedCount >= total;

  const boxes = [];
  for (let dz = 0; dz < h; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const key = `${dx},${dz}`;
      const color = colors.get(key);
      const isSkipped = skipped?.has(key);
      const isTarget = target?.dx === dx && target?.dz === dz;
      boxes.push(
        <Pressable
          key={key}
          onPress={onBoxPress ? () => onBoxPress(dx, dz) : undefined}
          style={{
            position: 'absolute',
            left: dx * cellPx,
            top: dz * cellPx,
            width: cellPx - 1,
            height: cellPx - 1,
            borderRadius: 3,
            backgroundColor: color ?? theme.inputBg,
            borderWidth: isTarget ? 3 : StyleSheet.hairlineWidth,
            borderColor: isTarget ? theme.accent : theme.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isSkipped && <Text style={{ color: theme.muted, fontSize: 10 }}>–</Text>}
        </Pressable>
      );
    }
  }

  return (
    <View style={styles.container}>
      <View style={{ width: w * cellPx, height: h * cellPx }}>{boxes}</View>
      <Text style={[styles.coverage, { color: complete ? '#22C55E' : theme.muted }]}>
        {complete
          ? '✓ Room complete'
          : `${recorded}/${total} boxes recorded${skippedCount ? `, ${skippedCount} skipped` : ''}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  coverage: {
    fontSize: 12,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
});
