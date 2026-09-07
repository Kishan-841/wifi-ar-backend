import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, PressableScale } from './components/anim';
import { ThemeProvider, useTheme } from './components/theme';
import ArScreen from './screens/ArScreen';
import HomeScreen from './screens/HomeScreen';
import MeasureScreen from './screens/MeasureScreen';
import ScansScreen from './screens/ScansScreen';
import WifiScreen from './screens/WifiScreen';

type Tab = 'wifi' | 'ar' | 'measure' | 'scans' | 'home';

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<Tab>('wifi');

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: theme.accent }]}>WiFi AR</Text>
          <PressableScale onPress={toggle} style={[styles.modeToggle, { backgroundColor: theme.card }]}>
            <Text style={styles.modeToggleText}>{theme.mode === 'dark' ? '☀️' : '🌙'}</Text>
          </PressableScale>
        </View>
        <View style={styles.tabs}>
          <TabButton label="Wi-Fi" active={tab === 'wifi'} onPress={() => setTab('wifi')} />
          <TabButton label="AR" active={tab === 'ar'} onPress={() => setTab('ar')} />
          <TabButton
            label="Measure"
            active={tab === 'measure'}
            onPress={() => setTab('measure')}
          />
          <TabButton label="Scans" active={tab === 'scans'} onPress={() => setTab('scans')} />
          <TabButton label="Home" active={tab === 'home'} onPress={() => setTab('home')} />
        </View>
      </View>

      <FadeSlideIn key={tab} style={styles.content}>
        {tab === 'wifi' ? (
          <WifiScreen />
        ) : tab === 'ar' ? (
          <ArScreen />
        ) : tab === 'measure' ? (
          <MeasureScreen />
        ) : tab === 'scans' ? (
          <ScansScreen />
        ) : (
          <HomeScreen />
        )}
      </FadeSlideIn>
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
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  tabText: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});
