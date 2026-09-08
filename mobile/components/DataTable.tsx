import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from './anim';
import { useTheme } from './theme';

/**
 * A quiet, structured table: one bordered container, a header row, hairline
 * dividers. Replaces the "floating cards" look for list-heavy screens.
 */
export type Column = { title: string; flex?: number; align?: 'left' | 'right' };
export type Row = { key: string; cells: ReactNode[]; onPress?: () => void };

export function Table({ columns, rows, empty }: { columns: Column[]; rows: Row[]; empty?: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.table, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.row, styles.headerRow, { borderBottomColor: theme.border }]}>
        {columns.map((c, i) => (
          <Text
            key={i}
            style={[
              styles.headerCell,
              { flex: c.flex ?? 1, color: theme.muted, textAlign: c.align ?? 'left' },
            ]}
          >
            {c.title}
          </Text>
        ))}
      </View>
      {rows.length === 0 && (
        <Text style={[styles.empty, { color: theme.muted }]}>{empty ?? 'Nothing here yet.'}</Text>
      )}
      {rows.map((r, ri) => {
        const content = (
          <View
            style={[
              styles.row,
              ri < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
            ]}
          >
            {r.cells.map((cell, i) => (
              <View
                key={i}
                style={{
                  flex: columns[i]?.flex ?? 1,
                  alignItems: columns[i]?.align === 'right' ? 'flex-end' : 'flex-start',
                  justifyContent: 'center',
                }}
              >
                {typeof cell === 'string' || typeof cell === 'number' ? (
                  <Text style={{ color: theme.text, fontSize: 13 }}>{cell}</Text>
                ) : (
                  cell
                )}
              </View>
            ))}
          </View>
        );
        return r.onPress ? (
          <PressableScale key={r.key} onPress={r.onPress}>
            {content}
          </PressableScale>
        ) : (
          <View key={r.key}>{content}</View>
        );
      })}
    </View>
  );
}

/** Small colored label, e.g. a role or a status. */
export function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color }]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

/** Two-line cell: primary text + muted secondary line. */
export function TwoLine({ primary, secondary }: { primary: string; secondary?: string }) {
  const { theme } = useTheme();
  return (
    <View>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
        {primary}
      </Text>
      {secondary ? (
        <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {secondary}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  headerRow: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    padding: 16,
    fontSize: 13,
  },
  chip: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
