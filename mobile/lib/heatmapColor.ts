/**
 * RSSI → color, banded per the plan's §14 interpretation table.
 * Bands (not a smooth gradient) keep the map readable at a glance:
 * a cell is "good" or "weak", not a subtle shade in between.
 * Thresholds are product-tunable after real-world testing.
 */

export type RssiBand = {
  min: number;
  color: string;
  label: string;
};

export const RSSI_BANDS: RssiBand[] = [
  { min: -50, color: '#2e7d32', label: 'very strong' },
  { min: -58, color: '#7cb342', label: 'strong' },
  { min: -66, color: '#fdd835', label: 'good' },
  { min: -74, color: '#fb8c00', label: 'weak' },
  { min: -82, color: '#e53935', label: 'very weak' },
  { min: -Infinity, color: '#7b1a1a', label: 'dead' },
];

export function rssiToColor(rssi: number): string {
  for (const band of RSSI_BANDS) {
    if (rssi >= band.min) return band.color;
  }
  return RSSI_BANDS[RSSI_BANDS.length - 1].color;
}
