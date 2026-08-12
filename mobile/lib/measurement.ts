import type { Pose, TrackingState } from '../components/ArPoseSource';
import type { WifiReading } from '../modules/wifi-info/src/WifiInfo.types';

/**
 * The core data structure of the entire product (plan section 17):
 * one Wi-Fi observation stapled to one AR position at one moment in time.
 */
export type Measurement = {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  rssi: number;
  ssid: string;
  bssid: string;
  frequency: number;
  /** AR tracking state at capture time — Phase 4 filtering depends on this. */
  trackingQuality: TrackingState;
};

export type Assessment =
  | { record: true; quality: 'good' | 'suspect' }
  | { record: false; reason: string };

/**
 * ══════════════════════════════════════════════════════════════════════
 *  THE RECORDING POLICY — this is a data-quality decision, not plumbing.
 *
 *  Question it answers: "given what we know right now, is this a
 *  measurement worth keeping, keeping-with-a-flag, or dropping?"
 *
 *  Current policy (deliberately strict on identity, lenient on tracking):
 *    - no pose yet, or Wi-Fi identity redacted/absent → DROP (unusable)
 *    - RSSI missing or Android's -127 "invalid" sentinel → DROP
 *    - AR state TRACKING                → record as 'good'
 *    - AR state LIMITED                 → record as 'suspect' (Phase 4 decides
 *                                         whether suspect points are usable)
 *    - INITIALIZING / UNAVAILABLE       → DROP (position is fiction)
 * ══════════════════════════════════════════════════════════════════════
 */
export function assessMeasurement(
  wifi: WifiReading | null,
  pose: Pose | null,
  tracking: TrackingState
): Assessment {
  if (!pose) return { record: false, reason: 'no AR pose yet' };
  if (tracking === 'INITIALIZING' || tracking === 'UNAVAILABLE') {
    return { record: false, reason: `AR ${tracking.toLowerCase()}` };
  }
  if (!wifi || !wifi.wifiConnected) return { record: false, reason: 'no Wi-Fi connection' };
  if (
    wifi.ssid == null ||
    wifi.bssid == null ||
    wifi.ssid === '<unknown ssid>' ||
    wifi.bssid === '02:00:00:00:00:00'
  ) {
    return { record: false, reason: 'Wi-Fi identity redacted' };
  }
  if (wifi.rssi == null || wifi.rssi === -127) {
    return { record: false, reason: 'invalid RSSI' };
  }

  return { record: true, quality: tracking === 'TRACKING' ? 'good' : 'suspect' };
}

/** Build the measurement once the assessment said "record". */
export function buildMeasurement(
  wifi: WifiReading,
  pose: Pose,
  tracking: TrackingState
): Measurement {
  return {
    timestamp: Date.now(),
    x: round2(pose.x),
    y: round2(pose.y),
    z: round2(pose.z),
    rssi: wifi.rssi!,
    ssid: wifi.ssid!,
    bssid: wifi.bssid!,
    frequency: wifi.frequency ?? 0,
    trackingQuality: tracking,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
