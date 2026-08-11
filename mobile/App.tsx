import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  PermissionsAndroid,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import WifiInfoModule from './modules/wifi-info/src/WifiInfoModule';
import type { WifiReading } from './modules/wifi-info/src/WifiInfo.types';

const POLL_INTERVAL_MS = 2000;

type PermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

export default function App() {
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [reading, setReading] = useState<WifiReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestPermission = useCallback(async () => {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location permission needed',
        message:
          'Android requires location permission to reveal Wi-Fi network details (SSID, BSSID).',
        buttonPositive: 'OK',
      }
    );
    if (result === PermissionsAndroid.RESULTS.GRANTED) setPermission('granted');
    else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) setPermission('blocked');
    else setPermission('denied');
  }, []);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    const poll = async () => {
      try {
        const result = await WifiInfoModule.getWifiInfo();
        setReading(result);
        setError(null);
        setPollCount((n) => n + 1);
      } catch (e) {
        setError(String(e));
      }
    };
    poll();
    pollTimer.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const redacted =
    reading != null &&
    (reading.ssid === '<unknown ssid>' || reading.bssid === '02:00:00:00:00:00');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>WiFi AR — Phase 1</Text>
        <Text style={styles.subtitle}>Wi-Fi Technical Spike</Text>

        {error && <Banner color="#b71c1c" text={`Native module error: ${error}`} />}

        {permission !== 'granted' && (
          <Banner
            color="#e65100"
            text={
              permission === 'blocked'
                ? 'Location permission permanently denied — enable it in system settings.'
                : 'Location permission not granted — SSID/BSSID will be redacted.'
            }
          />
        )}
        {permission === 'blocked' && (
          <Button label="Open settings" onPress={() => Linking.openSettings()} />
        )}
        {permission === 'denied' && (
          <Button label="Request permission again" onPress={requestPermission} />
        )}
        {reading && !reading.locationEnabled && (
          <Banner
            color="#e65100"
            text="System location services are OFF — Android redacts SSID/BSSID."
          />
        )}
        {reading && !reading.wifiConnected && (
          <Banner color="#b71c1c" text="Not connected to Wi-Fi." />
        )}
        {redacted && reading?.wifiConnected && (
          <Banner
            color="#e65100"
            text="Readings are redacted by Android (permission or location services)."
          />
        )}

        <View style={styles.card}>
          <Row label="SSID" value={reading?.ssid ?? '—'} />
          <Row label="BSSID" value={reading?.bssid ?? '—'} />
          <Row
            label="RSSI"
            value={reading?.rssi != null ? `${reading.rssi} dBm` : '—'}
            big
          />
          <Row
            label="Frequency"
            value={reading?.frequency != null ? `${reading.frequency} MHz (${bandOf(reading.frequency)})` : '—'}
          />
          <Row
            label="Link speed"
            value={reading?.linkSpeedMbps != null ? `${reading.linkSpeedMbps} Mbps` : '—'}
          />
        </View>

        <View style={styles.card}>
          <Row label="API source" value={reading?.source ?? '—'} />
          <Row label="Permission" value={permission} />
          <Row label="Location services" value={reading ? String(reading.locationEnabled) : '—'} />
          <Row label="Wi-Fi connected" value={reading ? String(reading.wifiConnected) : '—'} />
          <Row label="Polls" value={String(pollCount)} />
        </View>
      </ScrollView>
      <StatusBar style="light" />
    </View>
  );
}

function bandOf(freqMhz: number): string {
  if (freqMhz >= 2400 && freqMhz < 2500) return '2.4 GHz';
  if (freqMhz >= 4900 && freqMhz < 5900) return '5 GHz';
  if (freqMhz >= 5925) return '6 GHz';
  return '?';
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, big && styles.rowValueBig]}>{value}</Text>
    </View>
  );
}

function Banner({ color, text }: { color: string; text: string }) {
  return (
    <View style={[styles.banner, { backgroundColor: color }]}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1d2a',
  },
  scroll: {
    padding: 20,
    paddingTop: 64,
  },
  title: {
    color: '#4fc3f7',
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#90a4ae',
    fontSize: 14,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#122b3d',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLabel: {
    color: '#90a4ae',
    fontSize: 14,
  },
  rowValue: {
    color: '#ffffff',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  rowValueBig: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4fc3f7',
  },
  banner: {
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#1565c0',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
