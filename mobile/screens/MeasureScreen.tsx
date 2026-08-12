import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ViroARSceneNavigator } from '@reactvision/react-viro';

import {
  Pose,
  PoseTrackerScene,
  TrackingInfo,
  TrackingState,
} from '../components/ArPoseSource';
import { Banner, Button, Row, styles as ui } from '../components/DebugUI';
import { Measurement, assessMeasurement, buildMeasurement } from '../lib/measurement';
import WifiInfoModule from '../modules/wifi-info/src/WifiInfoModule';

/** One measurement attempt every 2s — matches the Wi-Fi poll cadence of Phase 1. */
const MEASURE_INTERVAL_MS = 2000;

export default function MeasureScreen() {
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [running, setRunning] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [rejected, setRejected] = useState(0);
  const [lastReason, setLastReason] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TrackingInfo>({
    state: 'INITIALIZING',
    reason: 'none',
  });

  // Latest pose lives in a ref: it updates 5×/s and the 2s ticker just reads
  // the freshest value — no re-render needed for every pose update here.
  const poseRef = useRef<Pose | null>(null);
  const trackingRef = useRef<TrackingState>('INITIALIZING');
  const runningRef = useRef(false);

  useEffect(() => {
    PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]).then((result) => {
      const cam = result[PermissionsAndroid.PERMISSIONS.CAMERA];
      setPermission(cam === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
    });
  }, []);

  useEffect(() => {
    runningRef.current = running;
    if (!running) return;

    const tick = async () => {
      if (!runningRef.current) return;
      try {
        const wifi = await WifiInfoModule.getWifiInfo();
        const pose = poseRef.current;
        const trackingState = trackingRef.current;
        const verdict = assessMeasurement(wifi, pose, trackingState);
        if (verdict.record) {
          setMeasurements((list) => [...list, buildMeasurement(wifi, pose!, trackingState)]);
          setLastReason(null);
        } else {
          setRejected((n) => n + 1);
          setLastReason(verdict.reason);
        }
      } catch (e) {
        setRejected((n) => n + 1);
        setLastReason(String(e));
      }
    };

    tick();
    const timer = setInterval(tick, MEASURE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [running]);

  const onPose = useCallback((p: Pose) => {
    poseRef.current = p;
  }, []);

  const onTracking = useCallback((state: TrackingState, reason: string) => {
    trackingRef.current = state;
    setTracking({ state, reason });
  }, []);

  if (permission !== 'granted') {
    return (
      <View style={styles.permissionContainer}>
        <Banner color="#e65100" text="Camera + location permissions are required to measure." />
      </View>
    );
  }

  const latest = measurements[measurements.length - 1];
  const suspectCount = measurements.filter((m) => m.trackingQuality !== 'TRACKING').length;

  return (
    <View style={styles.container}>
      <ViroARSceneNavigator
        autofocus
        initialScene={{ scene: PoseTrackerScene as any }}
        viroAppProps={{ onPose, onTracking }}
        style={styles.arView}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[ui.card, styles.overlayCard]}>
          <Row label="Tracking" value={tracking.state} />
          <Row label="Recorded" value={`${measurements.length} (${suspectCount} suspect)`} big />
          <Row label="Rejected" value={String(rejected)} />
          {lastReason && <Text style={styles.reasonText}>Last rejection: {lastReason}</Text>}

          {latest && (
            <>
              <Row
                label="Latest"
                value={`(${latest.x.toFixed(1)}, ${latest.y.toFixed(1)}, ${latest.z.toFixed(1)}) m`}
              />
              <Row label="RSSI @ position" value={`${latest.rssi} dBm`} />
              <Row label="AP" value={latest.bssid} />
            </>
          )}

          <Button
            label={running ? 'Stop measuring' : 'Start measuring'}
            onPress={() => setRunning((r) => !r)}
          />
          {!running && measurements.length > 0 && (
            <Button
              label="Clear measurements"
              onPress={() => {
                setMeasurements([]);
                setRejected(0);
                setLastReason(null);
              }}
            />
          )}
        </View>

        {!running && measurements.length > 0 && (
          <ScrollView style={styles.list}>
            {measurements
              .slice(-30)
              .reverse()
              .map((m) => (
                <Text key={m.timestamp} style={styles.listRow}>
                  {new Date(m.timestamp).toLocaleTimeString()}  ({m.x.toFixed(1)},{' '}
                  {m.y.toFixed(1)}, {m.z.toFixed(1)})  {m.rssi} dBm
                  {m.trackingQuality !== 'TRACKING' ? '  ⚠' : ''}
                </Text>
              ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  arView: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    padding: 12,
  },
  overlayCard: {
    opacity: 0.92,
  },
  reasonText: {
    color: '#ffb74d',
    fontSize: 12,
    marginVertical: 4,
  },
  list: {
    maxHeight: 180,
    marginTop: 8,
    backgroundColor: 'rgba(11, 29, 42, 0.92)',
    borderRadius: 8,
    padding: 8,
  },
  listRow: {
    color: '#cfd8dc',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    paddingVertical: 1,
  },
});
