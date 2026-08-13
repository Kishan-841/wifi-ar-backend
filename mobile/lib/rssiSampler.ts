import type { WifiReading } from '../modules/wifi-info/src/WifiInfo.types';

/**
 * Rolling RSSI buffer: collects fast raw samples and answers with a MEDIAN.
 *
 * Why median, not mean: RSSI occasionally spikes (a passing body, a retry
 * burst). One -70 spike among -49s drags a mean to -53; the median ignores it.
 *
 * Why reset on BSSID change: readings from two different access points are
 * measurements of two different radios — blending them produces a number that
 * describes nothing.
 */

/** How often the Wi-Fi module is sampled into the buffer. */
export const SAMPLE_INTERVAL_MS = 500;
/** How many recent samples the median is computed over. */
export const MEDIAN_WINDOW = 5;

export type FilteredRssi = {
  /** Median of the buffered samples. */
  rssi: number;
  /** How many samples the median is based on (< MEDIAN_WINDOW right after start/reset). */
  sampleCount: number;
  /** max - min over the buffer — the live noise band. */
  spread: number;
  bssid: string;
};

export class RssiSampler {
  private samples: number[] = [];
  private bssid: string | null = null;

  /** Feed one raw reading. Returns false if the reading was unusable. */
  add(reading: WifiReading): boolean {
    if (
      !reading.wifiConnected ||
      reading.bssid == null ||
      reading.bssid === '02:00:00:00:00:00' ||
      reading.rssi == null ||
      reading.rssi === -127
    ) {
      return false;
    }
    if (reading.bssid !== this.bssid) {
      // Roamed to a different AP (or first sample): start fresh.
      this.samples = [];
      this.bssid = reading.bssid;
    }
    this.samples.push(reading.rssi);
    if (this.samples.length > MEDIAN_WINDOW) this.samples.shift();
    return true;
  }

  /** Current filtered value, or null if we have nothing usable yet. */
  current(): FilteredRssi | null {
    if (this.bssid == null || this.samples.length === 0) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    return {
      rssi: sorted[Math.floor(sorted.length / 2)],
      sampleCount: this.samples.length,
      spread: sorted[sorted.length - 1] - sorted[0],
      bssid: this.bssid,
    };
  }

  reset() {
    this.samples = [];
    this.bssid = null;
  }
}
