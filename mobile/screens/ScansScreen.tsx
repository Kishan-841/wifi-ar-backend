import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { useConfirm } from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { Banner, Button } from '../components/DebugUI';
import { IconBadge, IconButton, ListGroup, ListItem } from '../components/ListItem';
import { LoadMore, SearchBar } from '../components/Paging';
import { useTheme } from '../components/theme';
import ScanDetailView from '../components/ScanDetailView';
import { ScanDetail, deleteScan, getScan, listScans } from '../lib/api';
import { usePagedList } from '../lib/usePagedList';

export default function ScansScreen({
  embedded,
  onCreate,
  refreshToken = 0,
}: { embedded?: boolean; onCreate?: () => void; refreshToken?: number } = {}) {
  const Container: any = embedded ? View : ScrollView;
  const { theme } = useTheme();
  const list = usePagedList(listScans);
  const { items: scans, refresh } = list;
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScanDetail | null>(null);
  const [opening, setOpening] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Re-fetch page one whenever the parent bumps the token (tab focus, pull-to-refresh).
  useEffect(() => {
    if (refreshToken > 0) refresh();
  }, [refresh, refreshToken]);

  const openScan = useCallback(async (id: string) => {
    setOpening(true);
    setError(null);
    try {
      setSelected(await getScan(id));
    } catch (e) {
      setError(String(e));
    } finally {
      setOpening(false);
    }
  }, []);

  if (opening) {
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

  const isEmpty = scans?.length === 0;
  const isFilteredEmpty = isEmpty && list.query.trim().length > 0;

  return (
    <Container contentContainerStyle={embedded ? undefined : styles.scroll}>
      {error && <Banner color={theme.danger} text={error} />}
      {list.error && <Banner color={theme.danger} text={list.error} />}

      {onCreate && (scans === null || !isEmpty || isFilteredEmpty) && (
        <View style={{ marginBottom: 14 }}>
          <Button label="Start new scan" onPress={onCreate} />
        </View>
      )}
      {(list.total > 0 || list.query.length > 0) && (
        <SearchBar
          value={list.query}
          onChange={list.setQuery}
          placeholder="Search rooms or networks"
          busy={list.searching || (list.loading && scans !== null)}
        />
      )}

      {scans === null && <ActivityIndicator color={theme.accent} size="large" />}
      {isEmpty && !isFilteredEmpty && (
        <EmptyState
          icon="scan-outline"
          title="No rooms saved yet"
          message="Scan a room and upload it — it will show up here with its heatmap."
          actionLabel={onCreate ? 'Scan a room' : undefined}
          onAction={onCreate}
        />
      )}
      {isFilteredEmpty && (
        <EmptyState icon="search-outline" title="No matches" message={`Nothing named “${list.query.trim()}”.`} />
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
      {scans && (
        <LoadMore
          shown={scans.length}
          total={list.total}
          hasMore={list.hasMore}
          loading={list.loadingMore}
          onPress={list.loadMore}
          noun="rooms"
        />
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
