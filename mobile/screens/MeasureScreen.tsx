import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  PermissionsAndroid,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ViroARSceneNavigator } from '@reactvision/react-viro';

import { PulseDot } from '../components/anim';
import {
  Pose,
  PoseTrackerScene,
  TrackingInfo,
  TrackingState,
} from '../components/ArPoseSource';
import { Banner, Button, Row, styles as ui } from '../components/DebugUI';
import GridMap from '../components/GridMap';
import { GridCell, GridSummary, addToGrid, summarizeGrid } from '../lib/grid';
import { uploadScan } from '../lib/api';
import {
  Measurement,
  assessMeasurement,
  buildMeasurement,
  summarizeRooms,
} from '../lib/measurement';
import { FilteredRssi, RssiSampler, SAMPLE_INTERVAL_MS } from '../lib/rssiSampler';
import WifiInfoModule from '../modules/wifi-info/src/WifiInfoModule';
import type { WifiReading } from '../modules/wifi-info/src/WifiInfo.types';

/** One measurement point is recorded per tick (median RSSI + freshest pose). */
const MEASURE_INTERVAL_MS = 2000;
/** Don't record until the median rests on at least this many samples. */
const MIN_SAMPLES = 3;

export default function MeasureScreen() {
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [running, setRunning] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [rejected, setRejected] = useState(0);
  const [lastReason, setLastReason] = useState<string | null>(null);
  const [filtered, setFiltered] = useState<FilteredRssi | null>(null);
  const [gridSummary, setGridSummary] = useState<GridSummary | null>(null);
  const [cells, setCells] = useState<GridCell[]>([]);
  const [livePose, setLivePose] = useState<Pose | null>(null);
  const [tracking, setTracking] = useState<TrackingInfo>({
    state: 'INITIALIZING',
    reason: 'none',
  });
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [roomModalVisible, setRoomModalVisible] = useState(false);
  const [roomDraft, setRoomDraft] = useState('');

  const [upload, setUpload] = useState<
    { state: 'idle' } | { state: 'sending' } | { state: 'done'; id: string } | { state: 'error'; message: string }
  >({ state: 'idle' });

  const scanStartRef = useRef<number>(0);
  const scanEndRef = useRef<number>(0);
  const roomRef = useRef<string | null>(null);
  const poseRef = useRef<Pose | null>(null);
  const trackingRef = useRef<TrackingState>('INITIALIZING');
  const runningRef = useRef(false);
  const samplerRef = useRef(new RssiSampler());
  const lastWifiRef = useRef<WifiReading | null>(null);
  const gridRef = useRef(new Map<string, GridCell>());

  useEffect(() => {
    PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]).then((result) => {
      const cam = result[PermissionsAndroid.PERMISSIONS.CAMERA];
      setPermission(cam === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
    });
  }, []);

  // Fast loop: keep the rolling RSSI buffer fed while measuring.
  useEffect(() => {
    if (!running) return;
    const sampleTimer = setInterval(async () => {
      try {
        const wifi = await WifiInfoModule.getWifiInfo();
        lastWifiRef.current = wifi;
        samplerRef.current.add(wifi);
        setFiltered(samplerRef.current.current());
      } catch {
        // Sampling errors surface via the record tick's rejection reason.
      }
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(sampleTimer);
  }, [running]);

  // Slow loop: record one filtered measurement point per tick.
  useEffect(() => {
    runningRef.current = running;
    if (!running) return;

    const tick = () => {
      if (!runningRef.current) return;
      const wifi = lastWifiRef.current;
      const pose = poseRef.current;
      const trackingState = trackingRef.current;
      const median = samplerRef.current.current();

      const verdict = assessMeasurement(wifi, pose, trackingState);
      if (!verdict.record) {
        setRejected((n) => n + 1);
        setLastReason(verdict.reason);
        return;
      }
      if (!median || median.sampleCount < MIN_SAMPLES) {
        setRejected((n) => n + 1);
        setLastReason(`warming up (${median?.sampleCount ?? 0}/${MIN_SAMPLES} samples)`);
        return;
      }

      // Record: identity from the raw reading, RSSI from the median filter.
      const m = buildMeasurement(
        { ...wifi!, rssi: median.rssi },
        pose!,
        trackingState,
        roomRef.current
      );
      setMeasurements((list) => [...list, m]);
      addToGrid(gridRef.current, m);
      setGridSummary(summarizeGrid(gridRef.current));
      setCells(Array.from(gridRef.current.values()));
      setLastReason(null);
    };

    const timer = setInterval(tick, MEASURE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [running]);

  const onPose = useCallback((p: Pose) => {
    poseRef.current = p;
    // Already throttled to 5/s at the source — cheap enough for the live dot.
    setLivePose(p);
  }, []);

  const onTracking = useCallback((state: TrackingState, reason: string) => {
    trackingRef.current = state;
    setTracking({ state, reason });
  }, []);

  const dumpDataset = useCallback(() => {
    const cells = Array.from(gridRef.current.entries()).map(([key, c]) => ({
      key,
      cx: c.cx,
      cz: c.cz,
      n: c.rssiValues.length,
      medianRssi: c.medianRssi,
      minRssi: c.minRssi,
      maxRssi: c.maxRssi,
      suspectCount: c.suspectCount,
    }));
    // One tagged line so it is easy to find and parse from the Metro log.
    console.log('WIFIAR_DATASET ' + JSON.stringify({ measurements, cells }));
  }, [measurements]);

  const clearAll = useCallback(() => {
    setMeasurements([]);
    setRejected(0);
    setLastReason(null);
    setFiltered(null);
    setGridSummary(null);
    setCells([]);
    samplerRef.current.reset();
    gridRef.current.clear();
  }, []);

  const startStop = useCallback(() => {
    if (running) {
      setRunning(false);
      scanEndRef.current = Date.now();
      // Camera unmounts now — AR session ends, its origin is gone.
      poseRef.current = null;
      setLivePose(null);
      trackingRef.current = 'INITIALIZING';
      setTracking({ state: 'INITIALIZING', reason: 'none' });
      return;
    }
    // Each start is a NEW AR session with a NEW origin — old points would
    // live in a different coordinate system, so a fresh scan starts clean.
    clearAll();
    roomRef.current = null;
    setCurrentRoom(null);
    setUpload({ state: 'idle' });
    scanStartRef.current = Date.now();
    setRunning(true);
  }, [running, clearAll]);

  const doUpload = useCallback(async () => {
    setUpload({ state: 'sending' });
    try {
      const result = await uploadScan({
        startedAt: scanStartRef.current,
        endedAt: scanEndRef.current || Date.now(),
        ssid: measurements[0]?.ssid ?? null,
        measurements,
      });
      setUpload({ state: 'done', id: result.id });
    } catch (e) {
      setUpload({ state: 'error', message: String(e) });
    }
  }, [measurements]);

  const confirmRoom = useCallback(() => {
    const name = roomDraft.trim();
    if (name.length > 0) {
      roomRef.current = name;
      setCurrentRoom(name);
    }
    setRoomDraft('');
    setRoomModalVisible(false);
  }, [roomDraft]);

  if (permission !== 'granted') {
    return (
      <View style={styles.permissionContainer}>
        <Banner color="#e65100" text="Camera + location permissions are required to measure." />
      </View>
    );
  }

  const latest = measurements[measurements.length - 1];

  return (
    <View style={styles.container}>
      {running ? (
        <ViroARSceneNavigator
          autofocus
          initialScene={{ scene: PoseTrackerScene as any }}
          viroAppProps={{ onPose, onTracking }}
          style={styles.arView}
        />
      ) : (
        <View style={styles.cameraOff}>
          <Text style={styles.cameraOffText}>
            Camera off — battery saver.{'\n'}Start measuring to activate AR tracking.
          </Text>
        </View>
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        {running && cells.length > 0 && (
          <View style={styles.miniMapPanel}>
            <GridMap cells={cells} currentPose={livePose} height={150} />
          </View>
        )}

        <View style={[ui.card, styles.overlayCard]}>
          {running && (
            <View style={styles.recordingRow}>
              <PulseDot />
              <Text style={styles.recordingText}>Recording</Text>
            </View>
          )}
          <Row label="Tracking" value={tracking.state} />
          {running && <Row label="Current room" value={currentRoom ?? '(untagged)'} />}
          <Row label="Points / cells" value={`${measurements.length} / ${gridSummary?.cells ?? 0}`} big />
          <Row label="Rejected" value={String(rejected)} />
          {lastReason && <Text style={styles.reasonText}>Last rejection: {lastReason}</Text>}

          {filtered && (
            <Row
              label="RSSI median (live)"
              value={`${filtered.rssi} dBm  (±${filtered.spread}, n=${filtered.sampleCount})`}
            />
          )}
          {latest && (
            <Row
              label="Latest point"
              value={`(${latest.x.toFixed(1)}, ${latest.z.toFixed(1)})  ${latest.rssi} dBm`}
            />
          )}
          {gridSummary && gridSummary.cells > 0 && (
            <>
              <Row
                label="Best / worst cell"
                value={`${gridSummary.strongest} / ${gridSummary.weakest} dBm`}
              />
              <Row label="Worst in-cell spread" value={`${gridSummary.worstCellSpread} dB`} />
            </>
          )}

          {running && (
            <Button
              label={currentRoom ? `📍 Leaving ${currentRoom} — new room` : '📍 Tag current room'}
              onPress={() => setRoomModalVisible(true)}
            />
          )}
          <Button
            label={running ? 'Stop measuring' : 'Start new scan'}
            variant={running ? 'danger' : 'primary'}
            onPress={startStop}
          />
          {!running && measurements.length > 0 && (
            <>
              <Text style={styles.reasonText}>
                Starting again begins a fresh scan — upload or dump this one first to keep it.
              </Text>
              {upload.state === 'done' ? (
                <Banner color="#1b5e20" text={`Uploaded ✓  scan ${upload.id.slice(0, 8)}…`} />
              ) : (
                <Button
                  label="Upload scan to server"
                  loading={upload.state === 'sending'}
                  onPress={doUpload}
                />
              )}
              {upload.state === 'error' && <Banner color="#b71c1c" text={upload.message} />}
              <Button label="Dump dataset to logs" variant="ghost" onPress={dumpDataset} />
              <Button label="Clear measurements" variant="ghost" onPress={clearAll} />
            </>
          )}
        </View>

        {!running && cells.length > 0 && (
          <View style={styles.fullMapPanel}>
            <GridMap cells={cells} height={240} showLegend />
          </View>
        )}

        {!running && measurements.length > 0 && (
          <View style={styles.roomStatsPanel}>
            {summarizeRooms(measurements).map((r) => (
              <View key={r.room} style={styles.roomStatsRow}>
                <Text style={styles.roomStatsName}>{r.room}</Text>
                <Text style={styles.roomStatsValue}>
                  {r.points} pts   median {r.medianRssi} dBm   ({r.minRssi}…{r.maxRssi})
                </Text>
              </View>
            ))}
          </View>
        )}

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

      <Modal
        visible={roomModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRoomModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Which room are you entering?</Text>
            <TextInput
              style={styles.modalInput}
              value={roomDraft}
              onChangeText={setRoomDraft}
              placeholder="e.g. Bedroom"
              placeholderTextColor="#546e7a"
              autoFocus
              onSubmitEditing={confirmRoom}
            />
            <Button label="Set room" onPress={confirmRoom} />
            <Button label="Cancel" variant="ghost" onPress={() => setRoomModalVisible(false)} />
          </View>
        </View>
      </Modal>
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
  cameraOff: {
    flex: 1,
    backgroundColor: '#0b1d2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOffText: {
    color: '#546e7a',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
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
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recordingText: {
    color: '#ef9a9a',
    fontSize: 13,
    fontWeight: '600',
  },
  reasonText: {
    color: '#ffb74d',
    fontSize: 12,
    marginVertical: 4,
  },
  miniMapPanel: {
    backgroundColor: 'rgba(11, 29, 42, 0.85)',
    borderRadius: 8,
    padding: 6,
    marginBottom: 8,
    alignSelf: 'center',
  },
  fullMapPanel: {
    backgroundColor: 'rgba(11, 29, 42, 0.92)',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  roomStatsPanel: {
    backgroundColor: 'rgba(11, 29, 42, 0.92)',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  roomStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  roomStatsName: {
    color: '#4fc3f7',
    fontSize: 12,
    fontWeight: '600',
  },
  roomStatsValue: {
    color: '#cfd8dc',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: '#122b3d',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  modalInput: {
    backgroundColor: '#0b1d2a',
    borderRadius: 8,
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  list: {
    maxHeight: 120,
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
