import { useCallback, useEffect, useState } from 'react';
import { PermissionsAndroid, StyleSheet, Text, View } from 'react-native';
import { ViroARSceneNavigator } from '@reactvision/react-viro';

import {
  Pose,
  PoseTrackerScene,
  TrackingInfo,
  TrackingState,
} from '../components/ArPoseSource';
import { Banner, Button, Row, styles as ui } from '../components/DebugUI';

export default function ArScreen() {
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [active, setActive] = useState(false);
  const [pose, setPose] = useState<Pose | null>(null);
  const [tracking, setTracking] = useState<TrackingInfo>({
    state: 'INITIALIZING',
    reason: 'none',
  });
  const [updateCount, setUpdateCount] = useState(0);
  const [sessionKey, setSessionKey] = useState(1);

  const toggleActive = () => {
    if (active) {
      setActive(false);
      setPose(null);
      setUpdateCount(0);
      setTracking({ state: 'INITIALIZING', reason: 'none' });
    } else {
      setSessionKey((k) => k + 1);
      setActive(true);
    }
  };

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

  const onTracking = useCallback((state: TrackingState, reason: string) => {
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
      {active ? (
        <ViroARSceneNavigator
          key={sessionKey}
          autofocus
          initialScene={{ scene: PoseTrackerScene as any }}
          viroAppProps={{ onPose, onTracking }}
          style={styles.arView}
        />
      ) : (
        <View style={styles.cameraOff}>
          <Text style={styles.cameraOffText}>
            Camera off — battery saver.{'\n'}Start AR to activate tracking.
          </Text>
        </View>
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[ui.card, styles.overlayCard]}>
          {active && (
            <>
              <Row label="Tracking" value={tracking.state} big />
              {tracking.state !== 'TRACKING' && tracking.reason !== 'none' && (
                <Text style={styles.reasonText}>Reason: {tracking.reason}</Text>
              )}
              <Row label="X (right)" value={pose ? `${pose.x.toFixed(2)} m` : '—'} />
              <Row label="Y (up)" value={pose ? `${pose.y.toFixed(2)} m` : '—'} />
              <Row label="Z (back)" value={pose ? `${pose.z.toFixed(2)} m` : '—'} />
              <Row
                label="Dist. from origin"
                value={pose ? `${horizontalDist.toFixed(2)} m` : '—'}
              />
              <Row label="Pose updates" value={String(updateCount)} />
            </>
          )}
          <Button label={active ? 'Stop AR' : 'Start AR'} onPress={toggleActive} />
          {active && (
            <Button label="Restart AR session" onPress={() => setSessionKey((k) => k + 1)} />
          )}
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
  reasonText: {
    color: '#ffb74d',
    fontSize: 12,
    marginBottom: 4,
  },
});
