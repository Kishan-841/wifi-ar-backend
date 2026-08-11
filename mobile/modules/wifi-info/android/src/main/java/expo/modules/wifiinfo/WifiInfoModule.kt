package expo.modules.wifiinfo

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WifiInfoModule : Module() {
  // Latest WifiInfo delivered by the system network callback (API 31+ path).
  @Volatile private var latestFromCallback: WifiInfo? = null
  private var networkCallback: ConnectivityManager.NetworkCallback? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val connectivityManager: ConnectivityManager
    get() = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

  override fun definition() = ModuleDefinition {
    Name("WifiInfo")

    AsyncFunction("getWifiInfo") {
      // Registration is retried on every call because it silently does nothing
      // until location permission has been granted by the user.
      ensureCallbackRegistered()
      readWifiInfo()
    }

    OnDestroy {
      networkCallback?.let { connectivityManager.unregisterNetworkCallback(it) }
      networkCallback = null
    }
  }

  private fun hasLocationPermission(): Boolean =
    context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
      PackageManager.PERMISSION_GRANTED

  private fun isLocationEnabled(): Boolean {
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return if (Build.VERSION.SDK_INT >= 28) lm.isLocationEnabled else true
  }

  private fun ensureCallbackRegistered() {
    // Pre-31 devices use the legacy synchronous read instead; and without
    // location permission the callback would only ever deliver redacted info.
    if (networkCallback != null || Build.VERSION.SDK_INT < 31 || !hasLocationPermission()) return

    val callback = object : ConnectivityManager.NetworkCallback(FLAG_INCLUDE_LOCATION_INFO) {
      override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
        latestFromCallback = capabilities.transportInfo as? WifiInfo
      }

      override fun onLost(network: Network) {
        latestFromCallback = null
      }
    }
    val request = NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
      .build()
    connectivityManager.registerNetworkCallback(request, callback)
    networkCallback = callback
  }

  private fun readWifiInfo(): Map<String, Any?> {
    val wifiConnected = connectivityManager.activeNetwork?.let {
      connectivityManager.getNetworkCapabilities(it)
        ?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
    } ?: false

    val info: WifiInfo?
    val source: String
    if (Build.VERSION.SDK_INT >= 31) {
      // Synchronous reads always redact SSID/BSSID on API 31+, so the cached
      // callback value is the only unredacted source.
      info = latestFromCallback
      source = "networkCallback"
    } else {
      @Suppress("DEPRECATION")
      val wifiManager =
        context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      @Suppress("DEPRECATION")
      info = wifiManager.connectionInfo
      source = "legacyConnectionInfo"
    }

    return mapOf(
      "wifiConnected" to wifiConnected,
      "hasLocationPermission" to hasLocationPermission(),
      "locationEnabled" to isLocationEnabled(),
      "source" to source,
      // Android wraps real SSIDs in quotes; "<unknown ssid>" arrives unquoted.
      "ssid" to info?.ssid?.removeSurrounding("\""),
      "bssid" to info?.bssid,
      "rssi" to info?.rssi,
      "frequency" to info?.frequency,
      "linkSpeedMbps" to info?.linkSpeed
    )
  }
}
