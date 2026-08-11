/**
 * One raw reading from the native Wi-Fi module.
 * Nullable fields are null when Android withholds the value
 * (no permission, location services off, or not connected).
 */
export type WifiReading = {
  /** Is the phone's active network a Wi-Fi network right now? */
  wifiConnected: boolean;
  /** Did the user grant ACCESS_FINE_LOCATION? Without it SSID/BSSID are redacted. */
  hasLocationPermission: boolean;
  /** Are system location services on? Android also redacts SSID/BSSID when off. */
  locationEnabled: boolean;
  /** Which Android API produced this reading (differs by Android version). */
  source: 'networkCallback' | 'legacyConnectionInfo';
  /** Network name, e.g. "MyHomeWiFi" — or "<unknown ssid>" when redacted. */
  ssid: string | null;
  /** MAC of the specific access point radio — "02:00:00:00:00:00" when redacted. */
  bssid: string | null;
  /** Signal strength in dBm (negative; closer to 0 = stronger). */
  rssi: number | null;
  /** Channel frequency in MHz (2412–2484 = 2.4 GHz, ~5180+ = 5 GHz). */
  frequency: number | null;
  /** Current link speed in Mbps. */
  linkSpeedMbps: number | null;
};
