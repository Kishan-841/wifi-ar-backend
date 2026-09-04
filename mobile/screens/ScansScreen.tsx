import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Row, styles as ui } from '../components/DebugUI';
import GridMap from '../components/GridMap';
import { ScanDetail, ScanSummary, getScan, listScans } from '../lib/api';
import { GridCell, addToGrid } from '../lib/grid';
import { summarizeRooms } from '../lib/measurement';

export default function ScansScreen() {
  const [scans, setScans] = useState<ScanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setScans(await listScans());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openScan = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      setSelected(await getScan(id));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  if (selected) {
    const grid = new Map<string, GridCell>();
    for (const m of selected.measurements) addToGrid(grid, m);
    const cells = Array.from(grid.values());
    const durationS = Math.round(
      (new Date(selected.endedAt).getTime() - new Date(selected.startedAt).getTime()) / 1000
    );

    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <Button label="← Back to scans" onPress={() => setSelected(null)} />
        <View style={ui.card}>
          <Row label="Network" value={selected.ssid ?? '—'} />
          <Row label="When" value={new Date(selected.startedAt).toLocaleString()} />
          <Row label="Duration" value={`${durationS}s`} />
          <Row label="Points / cells" value={`${selected.measurements.length} / ${cells.length}`} />
        </View>

        <View style={ui.card}>
          <GridMap cells={cells} height={260} showLegend />
        </View>

        <View style={ui.card}>
          {summarizeRooms(selected.measurements).map((r) => (
            <Row
              key={r.room}
              label={r.room}
              value={`${r.points} pts  median ${r.medianRssi} dBm  (${r.minRssi}…${r.maxRssi})`}
            />
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Button label={loading ? 'Loading…' : 'Refresh'} onPress={refresh} />
      {error && <Banner color="#b71c1c" text={error} />}
      {scans?.length === 0 && (
        <Banner color="#37474f" text="No scans saved yet — upload one from the Measure tab." />
      )}
      {scans?.map((s) => (
        <Pressable key={s.id} onPress={() => openScan(s.id)}>
          <View style={[ui.card, styles.scanCard]}>
            <Text style={styles.scanTitle}>{s.ssid ?? 'Unknown network'}</Text>
            <Text style={styles.scanMeta}>
              {new Date(s.startedAt).toLocaleString()}   {s.measurementCount} points
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  scanCard: {
    marginTop: 10,
  },
  scanTitle: {
    color: '#4fc3f7',
    fontSize: 16,
    fontWeight: '600',
  },
  scanMeta: {
    color: '#90a4ae',
    fontSize: 12,
    marginTop: 4,
  },
});
