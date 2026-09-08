import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, PermissionsAndroid, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Row, card, layout } from '../components/DebugUI';
import { useTheme } from '../components/theme';
import { RSSI_BANDS, bandRangeText, rssiBandOf } from '../lib/heatmapColor';
import WifiInfoModule from '../modules/wifi-info/src/WifiInfoModule';
import type { WifiReading } from '../modules/wifi-info/src/WifiInfo.types';

const POLL_INTERVAL_MS = 2000;

type PermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

export default function WifiScreen() {
  const { theme } = useTheme();
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [reading, setReading] = useState<WifiReading | null>(null);
  const [error, setError] = useState<string | null>(null);
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
        {error && <Banner color={theme.danger} text={`Native module error: ${error}`} />}

        {permission !== 'granted' && (
          <Banner
            color={theme.danger}
            text={
              permission === 'blocked'
                ? 'Location permission denied — enable it in system settings to read Wi-Fi details.'
                : 'Location permission is required to read Wi-Fi details.'
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
          <Banner color={theme.danger} text="Turn on Location services to read Wi-Fi details." />
        )}
        {reading && !reading.wifiConnected && (
          <Banner color={theme.danger} text="Not connected to Wi-Fi." />
        )}
        {redacted && reading?.wifiConnected && (
          <Banner color={theme.danger} text="Wi-Fi details are hidden — check permission and Location services." />
        )}

        <View style={card(theme)}>
          <Row label="SSID" value={reading?.ssid ?? '—'} />
          <Row label="BSSID" value={reading?.bssid ?? '—'} />
          <Row label="RSSI" value={reading?.rssi != null ? `${reading.rssi} dBm` : '—'} big />
          {reading?.rssi != null && (
            <View style={styles.qualityRow}>
              <Text style={[layout.rowLabel, { color: theme.muted }]}>Signal quality</Text>
              <View
                style={[styles.qualityChip, { backgroundColor: rssiBandOf(reading.rssi).color }]}
              >
                <Text style={styles.qualityChipText}>{rssiBandOf(reading.rssi).label}</Text>
              </View>
            </View>
          )}
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

        <View style={card(theme)}>
          <Text style={[styles.rangesTitle, { color: theme.muted }]}>Signal strength ranges</Text>
          {RSSI_BANDS.map((band, i) => {
            const active = reading?.rssi != null && rssiBandOf(reading.rssi) === band;
            return (
              <View
                key={band.label}
                style={[styles.rangeRow, active && { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}
              >
                <View style={[styles.rangeSwatch, { backgroundColor: band.color }]} />
                <Text
                  style={[
                    styles.rangeLabel,
                    { color: active ? theme.text : theme.muted },
                    active && styles.rangeTextActive,
                  ]}
                >
                  {band.label}
                </Text>
                <Text
                  style={[
                    styles.rangeValue,
                    { color: active ? theme.text : theme.muted },
                    active && styles.rangeTextActive,
                  ]}
                >
                  {bandRangeText(i)}
                </Text>
              </View>
            );
          })}
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
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  qualityChip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  qualityChipText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  rangesTitle: {
    fontSize: 13,
    marginBottom: 8,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 6,
    gap: 8,
  },
  rangeSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  rangeLabel: {
    fontSize: 13,
    flex: 1,
  },
  rangeValue: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  rangeTextActive: {
    fontWeight: '600',
  },
});
