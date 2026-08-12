import { useRef } from 'react';
import {
  ViroARScene,
  ViroTrackingReason,
  ViroTrackingStateConstants,
} from '@reactvision/react-viro';

/** How often the AR pose is allowed to update React state (native side is ~60fps). */
export const POSE_UPDATE_MS = 200;

export type Pose = { x: number; y: number; z: number };

export type TrackingState = 'INITIALIZING' | 'TRACKING' | 'LIMITED' | 'UNAVAILABLE';

export type TrackingInfo = {
  state: TrackingState;
  reason: string;
};

export type PoseSourceProps = {
  onPose?: (pose: Pose) => void;
  onTracking?: (state: TrackingState, reason: string) => void;
};

/**
 * The AR scene. Renders nothing visible — it exists to receive camera-transform
 * and tracking callbacks from ARCore (via Viro) and forward them to the host
 * screen through viroAppProps.
 */
export function PoseTrackerScene(props: any) {
  const appProps: PoseSourceProps =
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

function mapTrackingState(state: any): TrackingState {
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
