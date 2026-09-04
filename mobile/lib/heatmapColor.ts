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
  { min: -50, color: '#2e7d32', label: 'Excellent' },
  { min: -58, color: '#7cb342', label: 'Good' },
  { min: -66, color: '#fdd835', label: 'Fair' },
  { min: -74, color: '#fb8c00', label: 'Weak' },
  { min: -82, color: '#e53935', label: 'Poor' },
  { min: -Infinity, color: '#7b1a1a', label: 'Unusable' },
];

/** The band a given RSSI falls into — shared by the Wi-Fi screen and the heatmap. */
export function rssiBandOf(rssi: number): RssiBand {
  return RSSI_BANDS.find((b) => rssi >= b.min) ?? RSSI_BANDS[RSSI_BANDS.length - 1];
}

/** Human-readable dBm range for a band, e.g. "−58 to −51" — derived, never hand-written. */
export function bandRangeText(index: number): string {
  const band = RSSI_BANDS[index];
  if (index === 0) return `≥ ${band.min} dBm`;
  const upper = RSSI_BANDS[index - 1].min - 1;
  if (band.min === -Infinity) return `< ${RSSI_BANDS[index - 1].min} dBm`;
  return `${band.min} to ${upper} dBm`;
}

export function rssiToColor(rssi: number): string {
  return rssiBandOf(rssi).color;
}
