import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useConfirm } from '../components/ConfirmDialog';
import { Banner, Button, Row, card } from '../components/DebugUI';
import GridMap from '../components/GridMap';
import ShapeGrid from '../components/ShapeGrid';
import ScansScreen from './ScansScreen';
import { useTheme } from '../components/theme';
import { GridCell, GridSummary, addToGrid, summarizeGrid } from '../lib/grid';
import { ScanSummary, listScans, uploadScan } from '../lib/api';
import {
  Measurement,
  assessMeasurement,
  buildMeasurement,
  summarizeRooms,
} from '../lib/measurement';
import {
  Box,
  CELL_M,
  SAMPLE_SECONDS,
  STEP_DISTANCE_M,
  STILL_THRESHOLD_M,
  boxKey,
  moveHint,
  serpentineOrder,
} from '../lib/guided';
import { bestOrientation, fixedGridBox } from '../lib/roomFit';
import { rssiToColor } from '../lib/heatmapColor';
import { FilteredRssi, RssiSampler, SAMPLE_INTERVAL_MS } from '../lib/rssiSampler';
import WifiInfoModule from '../modules/wifi-info/src/WifiInfoModule';
import type { WifiReading } from '../modules/wifi-info/src/WifiInfo.types';

/** One measurement point is recorded per tick (median RSSI + freshest pose). */
const MEASURE_INTERVAL_MS = 2000;
/** Don't record until the median rests on at least this many samples. */
const MIN_SAMPLES = 3;

export default function MeasureScreen() {
  const { theme } = useTheme();
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
  /** True while the room modal is acting as the "name room, then start" gate. */
  const [pendingStart, setPendingStart] = useState(false);
  const [shapeWDraft, setShapeWDraft] = useState('');
  const [shapeHDraft, setShapeHDraft] = useState('');
  /** Room size bounds (boxes of 0.5 m): 1 box … 60 boxes = 30 m. */
  const MIN_BOXES = 1;
  const MAX_BOXES = 60;
  const sizeProblem = (() => {
    if (!shapeWDraft && !shapeHDraft) return null;
    const w = parseInt(shapeWDraft, 10);
    const h = parseInt(shapeHDraft, 10);
    if (!(Number.isFinite(w) && Number.isFinite(h))) return 'Enter both width and height.';
    if (w < MIN_BOXES || h < MIN_BOXES) return 'Each side must be at least 1 box.';
    if (w > MAX_BOXES || h > MAX_BOXES) return `Each side can be at most ${MAX_BOXES} boxes (30 m).`;
    return null;
  })();
  const [knownRooms, setKnownRooms] = useState<ScanSummary[]>([]);
  const [currentShape, setCurrentShape] = useState<{ w: number; h: number } | null>(null);
  const [listKey, setListKey] = useState(0);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const shapeRef = useRef<{ w: number | null; h: number | null }>({ w: null, h: null });

  /** Guided survey: the walk order defines position; AR only nudges "next box". */
  type Guided = {
    order: Box[];
    index: number;
    done: Map<string, number>;
    skipped: Set<string>;
    sampling: boolean;
  };
  const [guided, setGuided] = useState<Guided | null>(null);
  const guidedRef = useRef<Guided | null>(null);
  guidedRef.current = guided;
  const anchorPoseRef = useRef<Pose | null>(null);
  const recentPosesRef = useRef<{ t: number; p: Pose }[]>([]);
  const movedSinceAnchorRef = useRef(false);

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
      if (guidedRef.current) return; // guided mode records per box, not per tick
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

  /** Advance to the next box that is neither recorded nor skipped. */
  const nextIndex = (g: Guided, from: number) => {
    let i = from;
    while (i < g.order.length) {
      const k = boxKey(g.order[i]);
      if (!g.done.has(k) && !g.skipped.has(k)) return i;
      i += 1;
    }
    return g.order.length;
  };

  const recordBox = useCallback(() => {
    const g = guidedRef.current;
    if (!g || g.sampling || g.index >= g.order.length) return;
    const target = g.order[g.index];
    setGuided({ ...g, sampling: true });
    samplerRef.current.reset();
    setLastReason(null);

    setTimeout(() => {
      const gg = guidedRef.current;
      if (!gg) return;
      const median = samplerRef.current.current();
      const wifi = lastWifiRef.current;
      if (!median || median.sampleCount < 2 || !wifi?.bssid || wifi.bssid === '02:00:00:00:00:00') {
        setLastReason('no usable Wi-Fi sample — hold still and tap Record again');
        setGuided({ ...gg, sampling: false });
        return;
      }
      // Position comes from the BOX, not from AR: synthetic box-center coords.
      const m = buildMeasurement(
        { ...wifi, rssi: median.rssi },
        { x: target.dx * CELL_M, y: 0, z: -target.dz * CELL_M },
        trackingRef.current,
        roomRef.current
      );
      setMeasurements((list) => [...list, m]);
      addToGrid(gridRef.current, m);
      setGridSummary(summarizeGrid(gridRef.current));
      setCells(Array.from(gridRef.current.values()));

      const done = new Map(gg.done).set(boxKey(target), median.rssi);
      const skipped = new Set(gg.skipped);
      skipped.delete(boxKey(target));
      const next = { ...gg, done, skipped, sampling: false };
      next.index = nextIndex(next, gg.index + 1);
      setGuided(next);
      // AR resets here: the next "you moved a box" is measured from this spot.
      anchorPoseRef.current = poseRef.current;
      movedSinceAnchorRef.current = false;
    }, SAMPLE_SECONDS * 1000);
  }, []);

  const skipBox = useCallback(() => {
    const g = guidedRef.current;
    if (!g || g.sampling || g.index >= g.order.length) return;
    const skipped = new Set(g.skipped).add(boxKey(g.order[g.index]));
    const next = { ...g, skipped };
    next.index = nextIndex(next, g.index + 1);
    setGuided(next);
    anchorPoseRef.current = poseRef.current;
    movedSinceAnchorRef.current = false;
  }, []);

  const jumpToBox = useCallback((dx: number, dz: number) => {
    const g = guidedRef.current;
    if (!g || g.sampling) return;
    const i = g.order.findIndex((b) => b.dx === dx && b.dz === dz);
    if (i >= 0) setGuided({ ...g, index: i });
  }, []);

  // AR assist: when you have clearly moved about a box and then stand still,
  // record automatically. Drift can't accumulate — the anchor resets per box.
  useEffect(() => {
    if (!running || !guided) return;
    const timer = setInterval(() => {
      const g = guidedRef.current;
      const pose = poseRef.current;
      if (!g || g.sampling || g.index >= g.order.length || !pose) return;
      if (trackingRef.current !== 'TRACKING') return;

      const now = Date.now();
      const recent = recentPosesRef.current.filter((r) => now - r.t < 1200);
      recent.push({ t: now, p: pose });
      recentPosesRef.current = recent;
      const oldest = recent[0].p;
      const recentMove = Math.hypot(pose.x - oldest.x, pose.z - oldest.z);
      if (recentMove > 0.1) movedSinceAnchorRef.current = true;
      const still = recent.length >= 3 && recentMove < STILL_THRESHOLD_M;
      if (!still) return;

      const anchor = anchorPoseRef.current;
      if (!anchor) {
        // First box: standing still in the corner is enough.
        recordBox();
        return;
      }
      const moved = Math.hypot(pose.x - anchor.x, pose.z - anchor.z);
      if (moved >= STEP_DISTANCE_M && movedSinceAnchorRef.current) recordBox();
    }, 400);
    return () => clearInterval(timer);
  }, [running, guided, recordBox]);

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

  /** Leave the results view and return to the rooms list. */
  const finishScan = useCallback(() => {
    clearAll();
    setUpload({ state: 'idle' });
    setGuided(null);
    setCurrentShape(null);
    setListKey((k) => k + 1);
  }, [clearAll]);

  const reallyStart = useCallback(
    (room: string | null) => {
      // Each start is a NEW AR session with a NEW origin — old points would
      // live in a different coordinate system, so a fresh scan starts clean.
      clearAll();
      roomRef.current = room;
      setCurrentRoom(room);
      setUpload({ state: 'idle' });
      scanStartRef.current = Date.now();
      const { w, h } = shapeRef.current;
      if (w != null && h != null) {
        setGuided({
          order: serpentineOrder(w, h),
          index: 0,
          done: new Map(),
          skipped: new Set(),
          sampling: false,
        });
      } else {
        setGuided(null);
      }
      anchorPoseRef.current = null;
      recentPosesRef.current = [];
      movedSinceAnchorRef.current = false;
      setRunning(true);
    },
    [clearAll]
  );

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
    // Name the room first (one scan = one room piece for the Home board).
    setRoomDraft('');
    setShapeWDraft('');
    setShapeHDraft('');
    setPendingStart(true);
    setRoomModalVisible(true);
    // Offer existing rooms for re-scanning (newest scan per room name).
    listScans()
      .then((scans) => {
        const seen = new Map<string, ScanSummary>();
        for (const sc of scans) {
          if (sc.room && !seen.has(sc.room)) seen.set(sc.room, sc);
        }
        setKnownRooms(Array.from(seen.values()));
      })
      .catch(() => setKnownRooms([]));
  }, [running]);

  const doUpload = useCallback(async () => {
    setUpload({ state: 'sending' });
    try {
      const result = await uploadScan({
        startedAt: scanStartRef.current,
        endedAt: scanEndRef.current || Date.now(),
        ssid: measurements[0]?.ssid ?? null,
        shapeW: shapeRef.current.w,
        shapeH: shapeRef.current.h,
        measurements,
      });
      setUpload({ state: 'done', id: result.id });
    } catch (e) {
      setUpload({ state: 'error', message: String(e) });
    }
  }, [measurements]);

  const confirmRoom = useCallback(() => {
    const name = roomDraft.trim();
    setRoomDraft('');
    setRoomModalVisible(false);
    if (pendingStart) {
      const w = parseInt(shapeWDraft, 10);
      const h = parseInt(shapeHDraft, 10);
      if (!(Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0)) {
        // Size is mandatory — keep the dialog open.
        setRoomDraft(name);
        setRoomModalVisible(true);
        return;
      }
      setPendingStart(false);
      shapeRef.current = {
        w: Number.isFinite(w) && w > 0 ? w : null,
        h: Number.isFinite(h) && h > 0 ? h : null,
      };
      setCurrentShape(
        shapeRef.current.w != null && shapeRef.current.h != null
          ? { w: shapeRef.current.w, h: shapeRef.current.h }
          : null
      );
      reallyStart(name.length > 0 ? name : null);
      return;
    }
    if (name.length > 0) {
      roomRef.current = name;
      setCurrentRoom(name);
    }
  }, [roomDraft, pendingStart, reallyStart, shapeWDraft, shapeHDraft]);

  // Fixed-grid live view: the grid is anchored at the scan start; every
  // measurement maps to one immovable box (or is outside and already ignored).
  const shapeColors = useMemo(() => {
    const map = new Map<string, string>();
    if (!currentShape) return map;
    if (guided) {
      for (const [key, rssi] of guided.done) map.set(key, rssiToColor(rssi));
      return map;
    }
    const orientation = bestOrientation(measurements, currentShape.w, currentShape.h);
    const values = new Map<string, number[]>();
    for (const m of measurements) {
      const box = fixedGridBox(m.x, m.z, currentShape.w, currentShape.h, orientation);
      if (!box) continue;
      const key = `${box.dx},${box.dz}`;
      const list = values.get(key) ?? [];
      list.push(m.rssi);
      values.set(key, list);
    }
    for (const [key, list] of values) {
      const sorted = [...list].sort((a, b) => a - b);
      map.set(key, rssiToColor(sorted[Math.floor(sorted.length / 2)]));
    }
    return map;
  }, [currentShape, measurements, guided]);

  const guidedTarget = guided && guided.index < guided.order.length ? guided.order[guided.index] : null;
  const guidedPrev =
    guided && guided.index > 0 ? guided.order[Math.max(0, guided.index - 1)] : null;
  const guidedComplete = guided != null && guided.index >= guided.order.length;


  if (permission !== 'granted') {
    return (
      <View style={styles.permissionContainer}>
        <Banner color={theme.warn} text="Camera + location permissions are required to measure." />
      </View>
    );
  }

  const latest = measurements[measurements.length - 1];

  const roomModal = (
    <Modal
      visible={roomModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setRoomModalVisible(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            {pendingStart ? 'Which room is this scan for?' : 'Which room are you entering?'}
          </Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text }]}
            value={roomDraft}
            onChangeText={setRoomDraft}
            placeholder="e.g. Bedroom"
            placeholderTextColor={theme.muted}
            autoFocus
            onSubmitEditing={pendingStart ? undefined : confirmRoom}
            blurOnSubmit={false}
          />
          {pendingStart && knownRooms.length > 0 && (
            <View style={styles.chipRow}>
              {knownRooms.map((r) => (
                <Text
                  key={r.id}
                  style={[styles.roomChip, { backgroundColor: theme.inputBg, color: theme.text }]}
                  onPress={() => {
                    setRoomDraft(r.room ?? '');
                    setShapeWDraft(r.shapeW != null ? String(r.shapeW) : '');
                    setShapeHDraft(r.shapeH != null ? String(r.shapeH) : '');
                  }}
                >
                  ↻ {r.room}
                </Text>
              ))}
            </View>
          )}
          {pendingStart && (
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 8 }}>
              Stand in any corner to begin. The app highlights each box in turn —
              step into it, hold still, and it records. Skip boxes blocked by furniture.
            </Text>
          )}
          {pendingStart && (
            <View style={styles.shapeRow}>
              <Text style={{ color: theme.muted, fontSize: 13, flex: 1 }}>
                Room size (boxes) — required
              </Text>
              <TextInput
                style={[styles.shapeInput, { backgroundColor: theme.inputBg, color: theme.text }]}
                value={shapeWDraft}
                onChangeText={setShapeWDraft}
                placeholder="W"
                placeholderTextColor={theme.muted}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={{ color: theme.muted }}>×</Text>
              <TextInput
                style={[styles.shapeInput, { backgroundColor: theme.inputBg, color: theme.text }]}
                value={shapeHDraft}
                onChangeText={setShapeHDraft}
                placeholder="H"
                placeholderTextColor={theme.muted}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
          )}
          <Button
            label={pendingStart ? 'Start scan' : 'Set room'}
            disabled={
              pendingStart &&
              !(parseInt(shapeWDraft, 10) > 0 && parseInt(shapeHDraft, 10) > 0)
            }
            onPress={confirmRoom}
          />
          <Button
            label="Cancel"
            variant="ghost"
            onPress={() => {
              setRoomModalVisible(false);
              setPendingStart(false);
            }}
          />
        </View>
      </View>
    </Modal>
  );

  // Idle: no scan in progress and nothing collected — show the saved rooms
  // list right here (one place for everything about rooms).
  if (!running && measurements.length === 0) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.idleScroll}>
          <Text style={[styles.idleTitle, { color: theme.text }]}>Rooms</Text>
          <ScansScreen embedded key={listKey} onCreate={startStop} />
        </ScrollView>
        {roomModal}
      </View>
    );
  }

  const body = (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {running ? (
        <ViroARSceneNavigator
          autofocus
          initialScene={{ scene: PoseTrackerScene as any }}
          viroAppProps={{ onPose, onTracking }}
          style={styles.arView}
        />
      ) : (
        <View style={[styles.cameraOff, { backgroundColor: theme.bg }]}>
          <Text style={[styles.cameraOffText, { color: theme.muted }]}>
            Camera off — battery saver.{'\n'}Start measuring to activate AR tracking.
          </Text>
        </View>
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        {running && currentShape && guided && (
          <View style={[styles.miniMapPanel, { backgroundColor: theme.overlayCard }]}>
            <ShapeGrid
              w={currentShape.w}
              h={currentShape.h}
              colors={shapeColors}
              skipped={guided.skipped}
              target={guidedTarget}
              onBoxPress={jumpToBox}
            />
            <Text style={[styles.guideHint, { color: guidedComplete ? '#22C55E' : theme.text }]}>
              {guided.sampling
                ? 'Sampling Wi-Fi… hold still'
                : guidedComplete
                  ? '✓ Room complete — stop and upload'
                  : moveHint(guidedPrev, guidedTarget!)}
            </Text>
          </View>
        )}
        {running && !currentShape && cells.length > 0 && (
          <View style={[styles.miniMapPanel, { backgroundColor: theme.overlayCard }]}>
            <GridMap cells={cells} currentPose={livePose} height={150} />
          </View>
        )}

        <View style={[card(theme), { backgroundColor: theme.overlayCard, marginTop: 0 }]}>
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

          {running && guided && !guidedComplete && (
            <View style={styles.guidedButtons}>
              <View style={{ flex: 1 }}>
                <Button label="Record here" loading={guided.sampling} onPress={recordBox} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Skip (obstacle)" variant="ghost" onPress={skipBox} />
              </View>
            </View>
          )}
          {running && !guided && (
            <Button
              label={currentRoom ? `📍 Leaving ${currentRoom} — new room` : '📍 Tag current room'}
              onPress={() => setRoomModalVisible(true)}
            />
          )}
          {running && (
            <Button label="Stop measuring" variant="danger" onPress={startStop} />
          )}
          {!running && measurements.length > 0 && (
            <>
              {upload.state === 'done' ? (
                <>
                  <Banner color={theme.success} text="Room saved ✓" />
                  <Button label="Done" onPress={finishScan} />
                </>
              ) : (
                <Button
                  label="Save room to server"
                  loading={upload.state === 'sending'}
                  onPress={doUpload}
                />
              )}
              {upload.state === 'error' && <Banner color={theme.danger} text={upload.message} />}
              <Button
                label="← Back to rooms"
                variant="ghost"
                onPress={async () => {
                  if (upload.state === 'done') {
                    finishScan();
                    return;
                  }
                  const ok = await confirm({
                    title: 'Discard this scan?',
                    message: "It hasn't been saved to the server yet.",
                    confirmLabel: 'Discard',
                    icon: 'trash-outline',
                    destructive: true,
                  });
                  if (ok) finishScan();
                }}
              />
            </>
          )}
        </View>

        {!running && currentShape && measurements.length > 0 && (
          <View style={[styles.fullMapPanel, { backgroundColor: theme.overlayCard }]}>
            <ShapeGrid w={currentShape.w} h={currentShape.h} colors={shapeColors} />
            <Text style={[styles.reasonText, { marginTop: 6 }]}>
              Empty boxes are filled from nearest readings after upload.
            </Text>
          </View>
        )}
        {!running && !currentShape && cells.length > 0 && (
          <View style={[styles.fullMapPanel, { backgroundColor: theme.overlayCard }]}>
            <GridMap cells={cells} height={240} showLegend />
          </View>
        )}

        {!running && measurements.length > 0 && (
          <View style={[styles.roomStatsPanel, { backgroundColor: theme.overlayCard }]}>
            {summarizeRooms(measurements).map((r) => (
              <View key={r.room} style={styles.roomStatsRow}>
                <Text style={[styles.roomStatsName, { color: theme.accent }]}>{r.room}</Text>
                <Text style={[styles.roomStatsValue, { color: theme.text }]}>
                  {r.points} pts   median {r.medianRssi} dBm   ({r.minRssi}…{r.maxRssi})
                </Text>
              </View>
            ))}
          </View>
        )}

        {!running && measurements.length > 0 && (
          <ScrollView style={[styles.list, { backgroundColor: theme.overlayCard }]}>
            {measurements
              .slice(-30)
              .reverse()
              .map((m) => (
                <Text key={m.timestamp} style={[styles.listRow, { color: theme.muted }]}>
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

  if (running) {
    // A live AR camera surface must not live inside the swipeable pager
    // (a recycling container): scanning runs in its own full-screen window.
    return (
      <Modal visible animationType="slide" statusBarTranslucent onRequestClose={startStop}>
        {body}
        {roomModal}
      </Modal>
    );
  }
  return (
    <>
      {body}
      {roomModal}
      {confirmDialog}
    </>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOffText: {
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
  idleScroll: {
    padding: 20,
    paddingBottom: 40,
  },
  idleTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  idleSection: {
    fontSize: 13,
    marginTop: 20,
    marginBottom: 4,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  guideHint: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  guidedButtons: {
    flexDirection: 'row',
    gap: 10,
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
    borderRadius: 8,
    padding: 6,
    marginBottom: 8,
    alignSelf: 'center',
  },
  fullMapPanel: {
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  roomStatsPanel: {
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
    fontSize: 12,
    fontWeight: '600',
  },
  roomStatsValue: {
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
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  roomChip: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    overflow: 'hidden',
  },
  shapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  shapeInput: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    width: 52,
    textAlign: 'center',
  },
  modalInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  list: {
    maxHeight: 120,
    marginTop: 8,
    borderRadius: 8,
    padding: 8,
  },
  listRow: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    paddingVertical: 1,
  },
});
