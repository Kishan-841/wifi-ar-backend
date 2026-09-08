import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Row, card } from './DebugUI';
import GridMap from './GridMap';
import { useTheme } from './theme';
import type { ScanDetail } from '../lib/api';
import { GridCell, addToGrid } from '../lib/grid';
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
  const grid = new Map<string, GridCell>();
  for (const m of scan.measurements) addToGrid(grid, m);
  const cells = Array.from(grid.values());
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
        <GridMap cells={cells} height={260} showLegend />
      </View>

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
});
