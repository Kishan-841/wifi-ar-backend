import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, PermissionsAndroid, ScrollView, StyleSheet, View } from 'react-native';

import { Banner, Button, Row, styles as ui } from '../components/DebugUI';
import WifiInfoModule from '../modules/wifi-info/src/WifiInfoModule';
import type { WifiReading } from '../modules/wifi-info/src/WifiInfo.types';

const POLL_INTERVAL_MS = 2000;

type PermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

export default function WifiScreen() {
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

        <View style={ui.card}>
          <Row label="SSID" value={reading?.ssid ?? '—'} />
          <Row label="BSSID" value={reading?.bssid ?? '—'} />
          <Row label="RSSI" value={reading?.rssi != null ? `${reading.rssi} dBm` : '—'} big />
          <Row
            label="Frequency"
            value={
              reading?.frequency != null
                ? `${reading.frequency} MHz (${bandOf(reading.frequency)})`
                : '—'
            }
          />
          <Row
            label="Link speed"
            value={reading?.linkSpeedMbps != null ? `${reading.linkSpeedMbps} Mbps` : '—'}
          />
        </View>

        <View style={ui.card}>
          <Row label="API source" value={reading?.source ?? '—'} />
          <Row label="Permission" value={permission} />
          <Row label="Location services" value={reading ? String(reading.locationEnabled) : '—'} />
          <Row label="Wi-Fi connected" value={reading ? String(reading.wifiConnected) : '—'} />
          <Row label="Polls" value={String(pollCount)} />
        </View>
      </ScrollView>
    </View>
  );
}

function bandOf(freqMhz: number): string {
  if (freqMhz >= 2400 && freqMhz < 2500) return '2.4 GHz';
  if (freqMhz >= 4900 && freqMhz < 5900) return '5 GHz';
  if (freqMhz >= 5925) return '6 GHz';
  return '?';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
});
