import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  console.log('WiFi AR app loaded — Phase 0 hot-reload test');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WiFi AR</Text>
      <Text style={styles.subtitle}>Phase 0 — hot reload works! 🎉</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1d2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#4fc3f7',
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 8,
  },
});
