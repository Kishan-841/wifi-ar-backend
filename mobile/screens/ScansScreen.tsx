import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { useConfirm } from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { Banner, Button } from '../components/DebugUI';
import { IconBadge, IconButton, ListGroup, ListItem } from '../components/ListItem';
import { useTheme } from '../components/theme';
import ScanDetailView from '../components/ScanDetailView';
import { ScanDetail, ScanSummary, deleteScan, getScan, listScans } from '../lib/api';

export default function ScansScreen({ embedded, onCreate }: { embedded?: boolean; onCreate?: () => void } = {}) {
  const Container: any = embedded ? View : ScrollView;
  const { theme } = useTheme();
  const [scans, setScans] = useState<ScanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

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
        <EmptyState
          icon="scan-outline"
          title="No rooms saved yet"
          message="Scan a room and upload it — it will show up here with its heatmap."
          actionLabel={onCreate ? 'Scan a room' : undefined}
          onAction={onCreate}
        />
      )}
      {scans && scans.length > 0 && onCreate && (
        <View style={{ marginBottom: 14 }}>
          <Button label="Start new scan" onPress={onCreate} />
        </View>
      )}
      {scans && scans.length > 0 && (
        <ListGroup>
          {scans.map((s, i) => (
            <ListItem
              key={s.id}
              last={i === scans.length - 1}
              leading={<IconBadge name="grid-outline" color={theme.accent} />}
              title={s.room ?? s.ssid ?? 'Unknown network'}
              subtitle={new Date(s.startedAt).toLocaleString()}
              meta={`${s.shapeW != null ? `${s.shapeW}×${s.shapeH} boxes` : 'free-form'} · ${s.measurementCount} points`}
              onPress={() => openScan(s.id)}
              trailing={
                <IconButton
                  name="trash-outline"
                  color={theme.danger}
                  onPress={async () => {
                    const ok = await confirm({
                      title: `Delete ${s.room ?? 'this recording'}?`,
                      message: 'This cannot be undone.',
                      confirmLabel: 'Delete',
                      icon: 'trash-outline',
                      destructive: true,
                    });
                    if (!ok) return;
                    try {
                      await deleteScan(s.id);
                      refresh();
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                />
              }
            />
          ))}
        </ListGroup>
      )}
      {confirmDialog}
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
});
