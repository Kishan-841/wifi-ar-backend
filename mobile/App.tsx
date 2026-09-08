import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, PressableScale } from './components/anim';
import SettingsModal from './components/SettingsModal';
import { ThemeProvider, useTheme } from './components/theme';
import { loadServerUrl } from './lib/settings';
import HomeListScreen from './screens/HomeListScreen';
import MeasureScreen from './screens/MeasureScreen';
import WifiScreen from './screens/WifiScreen';

// The AR debug screen (screens/ArScreen.tsx) is kept for the future in-camera
// signal overlay but is not routed yet.
type Tab = 'wifi' | 'measure' | 'home';

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

  // The saved server URL must be known before any screen fetches.
  useEffect(() => {
    loadServerUrl().finally(() => setReady(true));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: theme.accent }]}>WiFi AR</Text>
          <View style={styles.headerButtons}>
            <PressableScale
              onPress={() => setSettingsOpen(true)}
              style={[styles.modeToggle, { backgroundColor: theme.card }]}
            >
              <Text style={styles.modeToggleText}>⚙️</Text>
            </PressableScale>
            <PressableScale onPress={toggle} style={[styles.modeToggle, { backgroundColor: theme.card }]}>
              <Text style={styles.modeToggleText}>{theme.mode === 'dark' ? '☀️' : '🌙'}</Text>
            </PressableScale>
          </View>
        </View>
        <View style={styles.tabs}>
          <TabButton label="Wi-Fi" active={tab === 'wifi'} onPress={() => setTab('wifi')} />
          <TabButton label="Measure" active={tab === 'measure'} onPress={() => setTab('measure')} />
          <TabButton label="Home" active={tab === 'home'} onPress={() => setTab('home')} />
        </View>
      </View>

      {ready && (
        <FadeSlideIn key={tab} style={styles.content}>
          {tab === 'wifi' ? <WifiScreen /> : tab === 'measure' ? <MeasureScreen /> : <HomeListScreen />}
        </FadeSlideIn>
      )}
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <PressableScale
      style={[styles.tab, { backgroundColor: active ? theme.primary : theme.card }]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, { color: active ? '#ffffff' : theme.muted }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
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
  tabs: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  tabText: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});
