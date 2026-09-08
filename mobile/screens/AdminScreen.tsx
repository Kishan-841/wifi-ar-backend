import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '../components/anim';
import { Chip, Table, TwoLine } from '../components/DataTable';
import { Banner, Button } from '../components/DebugUI';
import ScanDetailView from '../components/ScanDetailView';
import { useTheme } from '../components/theme';
import {
  AdminScanDetail,
  AdminScanSummary,
  AdminUser,
  adminDeleteUser,
  adminGetScan,
  adminListScans,
  adminListUsers,
} from '../lib/api';
import { getUser } from '../lib/auth';
import CreateUserScreen from './CreateUserScreen';

type Section = 'users' | 'recordings';

/** Admin area — mounted only for role 'admin'; the API enforces it regardless. */
export default function AdminScreen() {
  const { theme } = useTheme();
  const me = getUser();
  const [section, setSection] = useState<Section>('users');
  const [view, setView] = useState<'list' | 'create'>('list');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [scans, setScans] = useState<AdminScanSummary[] | null>(null);
  const [selected, setSelected] = useState<AdminScanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [u, s] = await Promise.all([adminListUsers(), adminListScans()]);
      setUsers(u);
      setScans(s);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <View style={styles.container}>
      {/* Section switcher */}
      <View style={[styles.segments, { backgroundColor: theme.inputBg }]}>
        {(['users', 'recordings'] as Section[]).map((s) => (
          <PressableScale
            key={s}
            onPress={() => setSection(s)}
            containerStyle={{ flex: 1 }}
            style={[styles.segment, section === s && { backgroundColor: theme.card }]}
          >
            <Text style={{ color: section === s ? theme.text : theme.muted, fontWeight: '600', fontSize: 13 }}>
              {s === 'users' ? `Users${users ? ` (${users.length})` : ''}` : `Recordings${scans ? ` (${scans.length})` : ''}`}
            </Text>
          </PressableScale>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {error && <Banner color={theme.danger} text={error} />}
        {notice && <Banner color={theme.success} text={notice} />}

        {section === 'users' && (
          <>
            <View style={styles.toolbar}>
              <Text style={[styles.heading, { color: theme.text }]}>Users</Text>
              <Button label="+ New user" onPress={() => { setNotice(null); setView('create'); }} />
            </View>
            {users === null ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <Table
                columns={[
                  { title: 'User', flex: 3 },
                  { title: 'Role', flex: 1.2 },
                  { title: 'Rec.', flex: 0.8, align: 'right' },
                  { title: 'Homes', flex: 0.9, align: 'right' },
                  { title: '', flex: 0.6, align: 'right' },
                ]}
                rows={users.map((u) => ({
                  key: u.id,
                  cells: [
                    <TwoLine key="n" primary={u.name} secondary={u.email} />,
                    <Chip key="r" label={u.role} color={u.role === 'admin' ? theme.primary : theme.info} />,
                    String(u.scanCount),
                    String(u.layoutCount),
                    u.role !== 'admin' && u.id !== me?.id ? (
                      <Text
                        key="x"
                        style={{ color: theme.danger, fontSize: 18, paddingHorizontal: 6 }}
                        onPress={async () => {
                          try {
                            await adminDeleteUser(u.id);
                            setNotice(`Deleted ${u.name} and their data`);
                            refresh();
                          } catch (e) {
                            setError(String((e as Error).message ?? e));
                          }
                        }}
                      >
                        ✕
                      </Text>
                    ) : (
                      <Text key="x" />
                    ),
                  ],
                }))}
                empty="No users yet."
              />
            )}
          </>
        )}

        {section === 'recordings' && (
          <>
            <Text style={[styles.heading, { color: theme.text, marginBottom: 10 }]}>All recordings</Text>
            {scans === null ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <Table
                columns={[
                  { title: 'Room', flex: 2.2 },
                  { title: 'By', flex: 1.4 },
                  { title: 'When', flex: 1.6 },
                  { title: 'Pts', flex: 0.7, align: 'right' },
                ]}
                rows={scans.map((s) => ({
                  key: s.id,
                  onPress: async () => {
                    try {
                      setSelected(await adminGetScan(s.id));
                    } catch (e) {
                      setError(String((e as Error).message ?? e));
                    }
                  },
                  cells: [
                    <TwoLine
                      key="r"
                      primary={s.room ?? '(untagged)'}
                      secondary={s.shapeW != null ? `${s.shapeW}×${s.shapeH} boxes · ${s.ssid ?? '—'}` : `free-form · ${s.ssid ?? '—'}`}
                    />,
                    s.user.name,
                    fmtDate(s.startedAt),
                    String(s.measurementCount),
                  ],
                }))}
                empty="No recordings yet."
              />
            )}
          </>
        )}
      </ScrollView>
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
  },
});
