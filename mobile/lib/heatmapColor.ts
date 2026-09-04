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
  { min: -50, color: '#22C55E', label: 'Excellent' },
  { min: -58, color: '#84CC16', label: 'Good' },
  { min: -66, color: '#F59E0B', label: 'Fair' },
  { min: -74, color: '#F97316', label: 'Weak' },
  { min: -82, color: '#EF4444', label: 'Very weak' },
  { min: -Infinity, color: '#991B1B', label: 'Unusable' },
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
