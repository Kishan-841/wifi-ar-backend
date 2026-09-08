import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { FadeSlideIn, PressableScale } from './components/anim';
import BottomBar from './components/BottomBar';
import SettingsModal from './components/SettingsModal';
import { ThemeProvider, useTheme } from './components/theme';
import { logout } from './lib/api';
import { getUser, loadSession, onAuthChange } from './lib/auth';
import { loadServerUrl } from './lib/settings';
import AdminScreen from './screens/AdminScreen';
import HomeListScreen from './screens/HomeListScreen';
import LoginScreen from './screens/LoginScreen';
import MeasureScreen from './screens/MeasureScreen';
import WifiScreen from './screens/WifiScreen';

// The AR debug screen (screens/ArScreen.tsx) is kept for the future in-camera
// signal overlay but is not routed yet.
type Tab = 'wifi' | 'measure' | 'home' | 'admin';

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<Tab>('measure');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(getUser());

  // Server URL and session must be known before any screen fetches.
  useEffect(() => {
    Promise.all([loadServerUrl(), loadSession()]).finally(() => {
      setUser(getUser());
      setReady(true);
    });
    return onAuthChange(() => setUser(getUser()));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: theme.accent }]}>WiFi AR</Text>
          <View style={styles.headerButtons}>
            {user && (
              <PressableScale
                onPress={() => logout()}
                style={[styles.logoutPill, { backgroundColor: theme.card }]}
              >
                <Text style={{ color: theme.muted, fontSize: 12 }} numberOfLines={1}>
                  {user.name} · Log out
                </Text>
              </PressableScale>
            )}
            <PressableScale
              onPress={() => setSettingsOpen(true)}
              style={[styles.modeToggle, { backgroundColor: theme.card }]}
            >
              <Ionicons name="settings-outline" size={20} color={theme.muted} />
            </PressableScale>
            <PressableScale onPress={toggle} style={[styles.modeToggle, { backgroundColor: theme.card }]}>
              <Ionicons name={theme.mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={20} color={theme.muted} />
            </PressableScale>
          </View>
        </View>
      </View>

      {ready && !user && <LoginScreen onOpenSettings={() => setSettingsOpen(true)} />}
      {ready && user && (
        <FadeSlideIn key={tab} style={styles.content}>
          {tab === 'wifi' ? (
            <WifiScreen />
          ) : tab === 'measure' ? (
            <MeasureScreen />
          ) : tab === 'home' ? (
            <HomeListScreen />
          ) : user.role === 'admin' ? (
            <AdminScreen />
          ) : (
            <HomeListScreen />
          )}
        </FadeSlideIn>
      )}
      {ready && user && (
        <BottomBar
          items={[
            { key: 'wifi', label: 'Wi-Fi', icon: 'wifi' },
            { key: 'measure', label: 'Measure', icon: 'scan-outline' },
            { key: 'home', label: 'Home', icon: 'home-outline' },
            ...(user.role === 'admin'
              ? [{ key: 'admin', label: 'Admin', icon: 'shield-checkmark-outline' as const }]
              : []),
          ]}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      )}
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  logoutPill: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    justifyContent: 'center',
    maxWidth: 170,
  },
  modeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleText: {
    fontSize: 17,
  },
  content: {
    flex: 1,
  },
});
