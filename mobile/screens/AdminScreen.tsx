import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FadeSlideIn, PressableScale } from '../components/anim';
import { Banner, Button, card } from '../components/DebugUI';
import ScanDetailView from '../components/ScanDetailView';
import { useTheme } from '../components/theme';
import {
  AdminScanDetail,
  AdminScanSummary,
  AdminUser,
  adminCreateUser,
  adminDeleteUser,
  adminGetScan,
  adminListScans,
  adminListUsers,
} from '../lib/api';
import { getUser } from '../lib/auth';

/** Admin tab — only mounted for role 'admin'; the API rejects everyone else anyway. */
export default function AdminScreen() {
  const { theme } = useTheme();
  const me = getUser();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [scans, setScans] = useState<AdminScanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminScanDetail | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
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

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const u = await adminCreateUser(name, email, password);
      setNotice(`Created ${u.name} — they can log in with ${u.email}`);
      setName('');
      setEmail('');
      setPassword('');
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setCreating(false);
    }
  };

  if (selected) {
    return (
      <ScanDetailView scan={selected} owner={selected.user} onBack={() => setSelected(null)} />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {error && <Banner color={theme.danger} text={error} />}
      {notice && <Banner color={theme.success} text={notice} />}

      <View style={card(theme)}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Create user</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text }]}
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={theme.muted}
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text }]}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text }]}
          value={password}
          onChangeText={setPassword}
          placeholder="Password (8+ characters)"
          placeholderTextColor={theme.muted}
          secureTextEntry
        />
        <Button
          label="Create user"
          loading={creating}
          disabled={!name.trim() || !email.trim() || password.length < 8}
          onPress={create}
        />
      </View>

      <View style={card(theme)}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Users</Text>
        {users === null && <ActivityIndicator color={theme.accent} />}
        {users?.map((u) => (
          <View key={u.id} style={styles.userRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600' }}>
                {u.name} {u.role === 'admin' ? '· admin' : ''}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>
                {u.email} · {u.scanCount} recordings · {u.layoutCount} homes
              </Text>
            </View>
            {u.role !== 'admin' && u.id !== me?.id && (
              <Text
                style={[styles.deleteX, { color: theme.muted }]}
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
            )}
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>All recordings</Text>
      {scans === null && <ActivityIndicator color={theme.accent} />}
      {scans?.length === 0 && <Text style={{ color: theme.muted }}>No recordings yet.</Text>}
      {scans?.map((s, i) => (
        <FadeSlideIn key={s.id} delay={Math.min(i * 30, 200)}>
          <PressableScale
            onPress={async () => {
              try {
                setSelected(await adminGetScan(s.id));
              } catch (e) {
                setError(String((e as Error).message ?? e));
              }
            }}
            style={[card(theme), styles.scanCard]}
          >
            <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '600' }}>
              {s.room ?? '(untagged)'}
              {s.shapeW != null ? `  ${s.shapeW}×${s.shapeH}` : ''}
            </Text>
            <Text style={{ color: theme.text, fontSize: 13, marginTop: 2 }}>by {s.user.name}</Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
              {new Date(s.startedAt).toLocaleString()} · {s.measurementCount} points · {s.ssid ?? '—'}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    marginTop: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  deleteX: {
    fontSize: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scanCard: {
    marginTop: 10,
  },
});
