import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, StyleSheet, Text, View } from 'react-native';
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroTrackingReason,
  ViroTrackingStateConstants,
} from '@reactvision/react-viro';

import { Banner, Button, Row, styles as ui } from '../components/DebugUI';

/** How often the AR pose is allowed to update React state (native side is ~60fps). */
const POSE_UPDATE_MS = 200;

type Pose = { x: number; y: number; z: number };

type TrackingInfo = {
  state: 'INITIALIZING' | 'TRACKING' | 'LIMITED' | 'UNAVAILABLE';
  reason: string;
};

/**
 * The AR scene itself. Renders nothing visible — it exists to receive
 * camera-transform and tracking callbacks from ARCore via Viro.
 */
function PoseTrackerScene(props: any) {
  const appProps =
    props.sceneNavigator?.viroAppProps ?? props.arSceneNavigator?.viroAppProps ?? {};
  const lastSent = useRef(0);

  return (
    <ViroARScene
      onTrackingUpdated={(state: any, reason: ViroTrackingReason) => {
        appProps.onTracking?.(mapTrackingState(state), mapTrackingReason(reason));
      }}
      onCameraTransformUpdate={(transform: any) => {
        const now = Date.now();
        if (now - lastSent.current < POSE_UPDATE_MS) return;
        lastSent.current = now;
        const [x, y, z] = transform.position;
        appProps.onPose?.({ x, y, z });
      }}
    />
  );
}

function mapTrackingState(state: any): TrackingInfo['state'] {
  switch (state) {
    case ViroTrackingStateConstants.TRACKING_NORMAL:
      return 'TRACKING';
    case ViroTrackingStateConstants.TRACKING_LIMITED:
      return 'LIMITED';
    case ViroTrackingStateConstants.TRACKING_UNAVAILABLE:
      return 'UNAVAILABLE';
    default:
      return 'INITIALIZING';
  }
}

function mapTrackingReason(reason: any): string {
  // Numeric constants from Viro: 1 = none, 2 = excessive motion, 3 = insufficient features
  switch (reason) {
    case 2:
      return 'moving too fast';
    case 3:
      return 'not enough visual features';
    default:
      return 'none';
  }
}

export default function ArScreen() {
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [pose, setPose] = useState<Pose | null>(null);
  const [tracking, setTracking] = useState<TrackingInfo>({
    state: 'INITIALIZING',
    reason: 'none',
  });
  const [updateCount, setUpdateCount] = useState(0);
  const [sessionKey, setSessionKey] = useState(1);

  const requestPermission = useCallback(async () => {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Camera permission needed',
      message: 'ARCore uses the camera to estimate the phone position in the room.',
      buttonPositive: 'OK',
    });
    setPermission(result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
  }, []);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const onPose = useCallback((p: Pose) => {
    setPose(p);
    setUpdateCount((n) => n + 1);
  }, []);

  const onTracking = useCallback((state: TrackingInfo['state'], reason: string) => {
    setTracking({ state, reason });
  }, []);

  if (permission !== 'granted') {
    return (
      <View style={styles.permissionContainer}>
        <Banner
          color="#e65100"
          text={
            permission === 'denied'
              ? 'Camera permission denied — AR cannot start without it.'
              : 'Requesting camera permission…'
          }
        />
        {permission === 'denied' && (
          <Button label="Request permission again" onPress={requestPermission} />
        )}
      </View>
    );
  }

  const horizontalDist = pose ? Math.sqrt(pose.x ** 2 + pose.z ** 2) : 0;

  return (
    <View style={styles.container}>
      <ViroARSceneNavigator
        key={sessionKey}
        autofocus
        initialScene={{ scene: PoseTrackerScene as any }}
        viroAppProps={{ onPose, onTracking }}
        style={styles.arView}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[ui.card, styles.overlayCard]}>
          <Row label="Tracking" value={tracking.state} big />
          {tracking.state !== 'TRACKING' && tracking.reason !== 'none' && (
            <Text style={styles.reasonText}>Reason: {tracking.reason}</Text>
          )}
          <Row label="X (right)" value={pose ? `${pose.x.toFixed(2)} m` : '—'} />
          <Row label="Y (up)" value={pose ? `${pose.y.toFixed(2)} m` : '—'} />
          <Row label="Z (back)" value={pose ? `${pose.z.toFixed(2)} m` : '—'} />
          <Row label="Dist. from origin" value={pose ? `${horizontalDist.toFixed(2)} m` : '—'} />
          <Row label="Pose updates" value={String(updateCount)} />
          <Button label="Restart AR session" onPress={() => setSessionKey((k) => k + 1)} />
        </View>
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
    marginBottom: 4,
  },
});
