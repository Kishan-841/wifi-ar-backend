import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Row, card } from './DebugUI';
import GridMap from './GridMap';
import { useTheme } from './theme';
import type { ScanDetail } from '../lib/api';
import { GridCell, addToGrid } from '../lib/grid';
import { rssiBandOf } from '../lib/heatmapColor';
import { summarizeRooms } from '../lib/measurement';

/** One saved recording: metadata, heatmap, per-room stats. Shared by the user's list and the admin view. */
export default function ScanDetailView({
  scan,
  owner,
  onBack,
  onDelete,
  embedded,
}: {
  scan: ScanDetail;
  owner?: { name: string; email: string } | null;
  onBack: () => void;
  onDelete?: () => void;
  embedded?: boolean;
}) {
  const { theme } = useTheme();
  const Container: any = embedded ? View : ScrollView;
  const [picked, setPicked] = useState<GridCell | null>(null);
  const grid = new Map<string, GridCell>();
  for (const m of scan.measurements) addToGrid(grid, m);
  const cells = Array.from(grid.values());
  const minCx = Math.min(...cells.map((c) => c.cx));
  const minCz = Math.min(...cells.map((c) => c.cz));
  const durationS = Math.round(
    (new Date(scan.endedAt).getTime() - new Date(scan.startedAt).getTime()) / 1000
  );

  return (
    <Container contentContainerStyle={embedded ? undefined : styles.scroll}>
      <Button label="← Back" variant="ghost" onPress={onBack} />
      <View style={card(theme)}>
        {owner && <Row label="Recorded by" value={`${owner.name} (${owner.email})`} />}
        <Row label="Network" value={scan.ssid ?? '—'} />
        <Row label="When" value={new Date(scan.startedAt).toLocaleString()} />
        <Row label="Duration" value={`${durationS}s`} />
        <Row
          label="Size"
          value={scan.shapeW != null ? `${scan.shapeW} × ${scan.shapeH} boxes` : 'free-form'}
        />
        <Row label="Points / cells" value={`${scan.measurements.length} / ${cells.length}`} />
      </View>

      <View style={card(theme)}>
        <GridMap
          cells={cells}
          height={260}
          showLegend
          onCellPress={(c) => setPicked((prev) => (prev && prev.cx === c.cx && prev.cz === c.cz ? null : c))}
          selectedKey={picked ? `${picked.cx},${picked.cz}` : null}
        />
        <Text style={[styles.hint, { color: theme.muted }]}>
          {picked ? '' : 'Tap a box to see its exact readings'}
        </Text>
      </View>

      {picked && (() => {
        const band = rssiBandOf(picked.medianRssi);
        const sorted = [...picked.rssiValues].sort((a, b) => b - a);
        return (
          <View style={card(theme)}>
            <View style={styles.pickHeader}>
              <View style={[styles.swatch, { backgroundColor: band.color }]} />
              <Text style={[styles.pickTitle, { color: theme.text }]}>
                Box {picked.cx - minCx + 1}, {picked.cz - minCz + 1}
                {picked.room ? ` · ${picked.room}` : ''}
              </Text>
            </View>
            <Text style={[styles.pickBig, { color: theme.accent }]}>{picked.medianRssi} dBm</Text>
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              {band.label} · median of {picked.rssiValues.length} reading{picked.rssiValues.length === 1 ? '' : 's'}
              {picked.rssiValues.length > 1 ? ` · range ${picked.minRssi} to ${picked.maxRssi}` : ''}
            </Text>
            <Text style={{ color: theme.text, fontSize: 13, marginTop: 8, fontVariant: ['tabular-nums'] }}>
              Recorded values: {sorted.join(', ')}
            </Text>
            {picked.suspectCount > 0 && (
              <Text style={{ color: '#F59E0B', fontSize: 12, marginTop: 6 }}>
                {picked.suspectCount} reading{picked.suspectCount === 1 ? '' : 's'} taken with limited AR tracking
              </Text>
            )}
          </View>
        );
      })()}

      <View style={card(theme)}>
        {summarizeRooms(scan.measurements).map((r) => (
          <Row
            key={r.room}
            label={r.room}
            value={`${r.points} pts  median ${r.medianRssi} dBm  (${r.minRssi}…${r.maxRssi})`}
          />
        ))}
      </View>

      {onDelete && <Button label="Delete this recording" variant="ghost" onPress={onDelete} />}
      {!onDelete && <Text style={{ height: 8 }} />}
    </Container>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  pickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  pickTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  pickBig: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
});
