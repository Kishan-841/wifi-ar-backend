import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '../components/anim';
import { useRefetchOnFocus } from '../components/ActiveTab';
import { useConfirm } from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { Banner, Button } from '../components/DebugUI';
import { Avatar, Chip, IconBadge, IconButton, ListGroup, ListItem } from '../components/ListItem';
import { LoadMore, SearchBar } from '../components/Paging';
import ScanDetailView from '../components/ScanDetailView';
import { useTheme } from '../components/theme';
import {
  AdminScanDetail,
  AdminUser,
  adminDeleteUser,
  adminGetScan,
  adminListScans,
  adminListUsers,
} from '../lib/api';
import { getUser } from '../lib/auth';
import { usePagedList } from '../lib/usePagedList';
import { rssiBandOf } from '../lib/heatmapColor';
import CreateUserScreen from './CreateUserScreen';

type Section = 'users' | 'recordings';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};

/** Admin area — mounted only for role 'admin'; the API enforces it regardless. */
export default function AdminScreen() {
  const { theme } = useTheme();
  const me = getUser();
  const [section, setSection] = useState<Section>('users');
  const [view, setView] = useState<'list' | 'create'>('list');
  const userList = usePagedList(adminListUsers);
  const scanList = usePagedList(adminListScans);
  const users = userList.items;
  const scans = scanList.items;
  const [selected, setSelected] = useState<AdminScanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const { refresh: refreshUsers } = userList;
  const { refresh: refreshScans } = scanList;
  const refresh = useCallback(async () => {
    setError(null);
    await Promise.all([refreshUsers(), refreshScans()]);
  }, [refreshUsers, refreshScans]);
  useRefetchOnFocus('admin', refresh);

  const [pulling, setPulling] = useState(false);
  const pullRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refresh();
    } finally {
      setPulling(false);
    }
  }, [refresh]);

  const confirmDelete = async (u: AdminUser) => {
    const ok = await confirm({
      title: `Delete ${u.name}?`,
      message: `Removes their account, ${u.scanCount} recording${u.scanCount === 1 ? '' : 's'} and ${u.layoutCount} home${u.layoutCount === 1 ? '' : 's'}. This cannot be undone.`,
      confirmLabel: 'Delete',
      icon: 'trash-outline',
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminDeleteUser(u.id);
      setNotice(`Deleted ${u.name}`);
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  };

  if (view === 'create') {
    return (
      <CreateUserScreen
        onCancel={() => setView('list')}
        onDone={(name) => {
          setNotice(`Created ${name}`);
          setView('list');
          refresh();
        }}
      />
    );
  }

  if (selected) {
    return <ScanDetailView scan={selected} owner={selected.user} onBack={() => setSelected(null)} />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.segments, { backgroundColor: theme.inputBg }]}>
        {(['users', 'recordings'] as Section[]).map((s) => (
          <PressableScale
            key={s}
            onPress={() => setSection(s)}
            containerStyle={{ flex: 1 }}
            style={[styles.segment, section === s && { backgroundColor: theme.card }]}
          >
            <Text style={{ color: section === s ? theme.text : theme.muted, fontWeight: '600', fontSize: 13 }}>
              {s === 'users' ? `Users${users ? ` · ${userList.total}` : ''}` : `Recordings${scans ? ` · ${scanList.total}` : ''}`}
            </Text>
          </PressableScale>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={pullRefresh} tintColor={theme.accent} colors={[theme.accent]} />
        }
      >
        {error && <Banner color={theme.danger} text={error} />}
        {userList.error && section === 'users' && <Banner color={theme.danger} text={userList.error} />}
        {scanList.error && section === 'recordings' && <Banner color={theme.danger} text={scanList.error} />}
        {notice && <Banner color={theme.success} text={notice} />}

        {section === 'users' && (
          <>
            <Button label="+ New user" onPress={() => { setNotice(null); setView('create'); }} />
            <View style={{ height: 14 }} />
            <SearchBar
              value={userList.query}
              onChange={userList.setQuery}
              placeholder="Search by name or email"
              busy={userList.searching || (userList.loading && users !== null)}
            />
            {users === null ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <ListGroup>
                {users.map((u, i) => (
                  <ListItem
                    key={u.id}
                    last={i === users.length - 1}
                    leading={<Avatar name={u.name} />}
                    title={u.name}
                    titleAccessory={u.role === 'admin' ? <Chip label="Admin" color={theme.primary} /> : undefined}
                    subtitle={u.email}
                    meta={`${u.scanCount} recording${u.scanCount === 1 ? '' : 's'} · ${u.layoutCount} home${u.layoutCount === 1 ? '' : 's'}`}
                    trailing={
                      u.role !== 'admin' && u.id !== me?.id ? (
                        <IconButton name="trash-outline" color={theme.danger} onPress={() => confirmDelete(u)} />
                      ) : undefined
                    }
                  />
                ))}
              </ListGroup>
            )}
            {users && (
              <LoadMore
                shown={users.length}
                total={userList.total}
                hasMore={userList.hasMore}
                loading={userList.loadingMore}
                onPress={userList.loadMore}
                noun="users"
              />
            )}
          </>
        )}

        {section === 'recordings' && (
          <>
            {(scanList.total > 0 || scanList.query.length > 0) && (
              <SearchBar
                value={scanList.query}
                onChange={scanList.setQuery}
                placeholder="Search room, network or user"
                busy={scanList.searching || (scanList.loading && scans !== null)}
              />
            )}
            {scans === null ? (
              <ActivityIndicator color={theme.accent} />
            ) : scans.length === 0 ? (
              scanList.query.trim() ? (
                <EmptyState icon="search-outline" title="No matches" message={`Nothing matching “${scanList.query.trim()}”.`} />
              ) : (
                <EmptyState
                  icon="grid-outline"
                  title="No recordings yet"
                  message="Recordings appear here as users scan and upload rooms."
                />
              )
            ) : (
              <ListGroup>
                {scans.map((s, i) => (
                  <ListItem
                    key={s.id}
                    last={i === scans.length - 1}
                    leading={<IconBadge name="grid-outline" color={theme.accent} />}
                    title={s.room ?? '(untagged)'}
                    subtitle={`by ${s.user.name} · ${fmtDate(s.startedAt)}`}
                    meta={`${s.shapeW != null ? `${s.shapeW}×${s.shapeH} boxes` : 'free-form'} · ${s.measurementCount} points · ${s.ssid ?? '—'}`}
                    trailing={<IconButton name="chevron-forward" color={theme.muted} />}
                    onPress={async () => {
                      try {
                        setSelected(await adminGetScan(s.id));
                      } catch (e) {
                        setError(String((e as Error).message ?? e));
                      }
                    }}
                  />
                ))}
              </ListGroup>
            )}
            {scans && (
              <LoadMore
                shown={scans.length}
                total={scanList.total}
                hasMore={scanList.hasMore}
                loading={scanList.loadingMore}
                onPress={scanList.loadMore}
                noun="recordings"
              />
            )}
          </>
        )}
      </ScrollView>
      {confirmDialog}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segments: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 4,
    padding: 3,
    borderRadius: 10,
  },
  segment: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
});
