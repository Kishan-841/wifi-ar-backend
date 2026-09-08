import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from './components/anim';
import BottomBar from './components/BottomBar';
import { PagerLockContext } from './components/PagerLock';
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
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const { theme, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('measure');
  const [pagerLocked, setPagerLocked] = useState(false);
  const pagerRef = useRef<PagerView>(null);
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

  const tabs = useMemo(
    () =>
      [
        { key: 'wifi' as Tab, label: 'Wi-Fi', icon: 'wifi' as const },
        { key: 'measure' as Tab, label: 'Measure', icon: 'scan-outline' as const },
        { key: 'home' as Tab, label: 'Home', icon: 'home-outline' as const },
        ...(user?.role === 'admin'
          ? [{ key: 'admin' as Tab, label: 'Admin', icon: 'shield-checkmark-outline' as const }]
          : []),
      ],
    [user?.role]
  );

  const goTo = (key: Tab) => {
    setTab(key);
    const i = tabs.findIndex((t) => t.key === key);
    if (i >= 0) pagerRef.current?.setPage(i);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
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
        <PagerLockContext.Provider value={setPagerLocked}>
          <PagerView
            ref={pagerRef}
            style={styles.content}
            initialPage={tabs.findIndex((t) => t.key === tab)}
            scrollEnabled={!pagerLocked}
            onPageSelected={(e) => setTab(tabs[e.nativeEvent.position]?.key ?? 'measure')}
          >
            {tabs.map((t) => (
              <View key={t.key} style={styles.page}>
                {t.key === 'wifi' ? (
                  <WifiScreen />
                ) : t.key === 'measure' ? (
                  <MeasureScreen />
                ) : t.key === 'home' ? (
                  <HomeListScreen />
                ) : (
                  <AdminScreen />
                )}
              </View>
            ))}
          </PagerView>
        </PagerLockContext.Provider>
      )}
      {ready && user && <BottomBar items={tabs} active={tab} onChange={(k) => goTo(k as Tab)} />}
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
  page: {
    flex: 1,
  },
});
