import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from './components/DebugUI';
import ArScreen from './screens/ArScreen';
import WifiScreen from './screens/WifiScreen';

type Tab = 'wifi' | 'ar';

export default function App() {
  const [tab, setTab] = useState<Tab>('wifi');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WiFi AR</Text>
        <View style={styles.tabs}>
          <TabButton label="Wi-Fi" active={tab === 'wifi'} onPress={() => setTab('wifi')} />
          <TabButton label="AR" active={tab === 'ar'} onPress={() => setTab('ar')} />
        </View>
      </View>

      {tab === 'wifi' ? <WifiScreen /> : <ArScreen />}
      <StatusBar style="light" />
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
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    color: palette.accent,
    fontSize: 24,
    fontWeight: 'bold',
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
    backgroundColor: palette.card,
  },
  tabActive: {
    backgroundColor: '#1565c0',
  },
  tabText: {
    color: palette.muted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
});
