import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, PressableScale } from '../components/anim';
import { Banner, Button, card } from '../components/DebugUI';
import { useTheme } from '../components/theme';
import ScanDetailView from '../components/ScanDetailView';
import { ScanDetail, ScanSummary, deleteScan, getScan, listScans } from '../lib/api';

export default function ScansScreen({ embedded }: { embedded?: boolean } = {}) {
  const Container: any = embedded ? View : ScrollView;
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
    return (
      <ScanDetailView
        scan={selected}
        embedded={embedded}
        onBack={() => setSelected(null)}
        onDelete={async () => {
          try {
            await deleteScan(selected.id);
            setSelected(null);
            refresh();
          } catch (e) {
            setError(String(e));
          }
        }}
      />
    );
  }

  return (
    <Container contentContainerStyle={embedded ? undefined : styles.scroll}>
      {!embedded && <Button label="Refresh" variant="ghost" loading={loading} onPress={refresh} />}
      {error && <Banner color={theme.danger} text={error} />}
      {scans?.length === 0 && (
        <Banner color={theme.info} text="No rooms saved yet — scan one above." />
      )}
      {scans?.map((s, i) => (
        <FadeSlideIn key={s.id} delay={Math.min(i * 40, 200)}>
          <PressableScale onPress={() => openScan(s.id)} style={[card(theme), styles.scanCard]}>
            <View style={styles.scanRow}>
              <View style={styles.scanInfo}>
                <Text style={[styles.scanTitle, { color: theme.accent }]}>
                  {s.room ?? s.ssid ?? 'Unknown network'}
                </Text>
                <Text style={[styles.scanMeta, { color: theme.muted }]}>
                  {new Date(s.startedAt).toLocaleString()}   {s.measurementCount} points
                  {s.shapeW != null ? `   ${s.shapeW}×${s.shapeH}` : '   free-form'}
                </Text>
              </View>
              <Text
                style={[styles.deleteX, { color: theme.muted }]}
                onPress={async () => {
                  try {
                    await deleteScan(s.id);
                    refresh();
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                ✕
              </Text>
            </View>
          </PressableScale>
        </FadeSlideIn>
      ))}
    </Container>
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
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanInfo: {
    flex: 1,
  },
  deleteX: {
    fontSize: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
