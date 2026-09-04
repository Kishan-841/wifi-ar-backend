import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, PressableScale } from '../components/anim';
import { Banner, Button, Row, card } from '../components/DebugUI';
import { useTheme } from '../components/theme';
import GridMap from '../components/GridMap';
import { ScanDetail, ScanSummary, getScan, listScans } from '../lib/api';
import { GridCell, addToGrid } from '../lib/grid';
import { summarizeRooms } from '../lib/measurement';

export default function ScansScreen() {
  const { theme } = useTheme();
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

  if (loading && !selected) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  if (selected) {
    const grid = new Map<string, GridCell>();
    for (const m of selected.measurements) addToGrid(grid, m);
    const cells = Array.from(grid.values());
    const durationS = Math.round(
      (new Date(selected.endedAt).getTime() - new Date(selected.startedAt).getTime()) / 1000
    );

    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <Button label="← Back to scans" variant="ghost" onPress={() => setSelected(null)} />
        <View style={card(theme)}>
          <Row label="Network" value={selected.ssid ?? '—'} />
          <Row label="When" value={new Date(selected.startedAt).toLocaleString()} />
          <Row label="Duration" value={`${durationS}s`} />
          <Row label="Points / cells" value={`${selected.measurements.length} / ${cells.length}`} />
        </View>

        <View style={card(theme)}>
          <GridMap cells={cells} height={260} showLegend />
        </View>

        <View style={card(theme)}>
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
      <Button label="Refresh" variant="ghost" loading={loading} onPress={refresh} />
      {error && <Banner color="#b71c1c" text={error} />}
      {scans?.length === 0 && (
        <Banner color="#37474f" text="No scans saved yet — upload one from the Measure tab." />
      )}
      {scans?.map((s, i) => (
        <FadeSlideIn key={s.id} delay={Math.min(i * 40, 200)}>
          <PressableScale onPress={() => openScan(s.id)} style={[card(theme), styles.scanCard]}>
            <Text style={[styles.scanTitle, { color: theme.accent }]}>{s.ssid ?? 'Unknown network'}</Text>
            <Text style={[styles.scanMeta, { color: theme.muted }]}>
              {new Date(s.startedAt).toLocaleString()}   {s.measurementCount} points
            </Text>
          </PressableScale>
        </FadeSlideIn>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCard: {
    marginTop: 10,
  },
  scanTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  scanMeta: {
    fontSize: 12,
    marginTop: 4,
  },
});
