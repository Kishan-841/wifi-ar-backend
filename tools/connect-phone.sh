#!/bin/bash
# Reconnect the Moto G84 over wireless adb without needing to read the port
# from the phone. Requires: Wireless debugging toggled ON on the phone
# (Settings -> Developer options -> Wireless debugging) and same Wi-Fi network.
#
# Usage:  ./tools/connect-phone.sh            (auto-discover via mDNS)
#         ./tools/connect-phone.sh IP:PORT    (connect to an explicit address)

ADB="$HOME/Library/Android/sdk/platform-tools/adb"

restore_tunnels() {
  # Dev tunnels the app relies on: Metro (8081) + backend API (4000).
  "$ADB" reverse tcp:8081 tcp:8081 2>/dev/null
  "$ADB" reverse tcp:4000 tcp:4000 2>/dev/null
  echo "Reverse tunnels restored (8081, 4000)."
}

if [ -n "$1" ]; then
  "$ADB" connect "$1" && restore_tunnels
  exit $?
fi

echo "Searching for the phone via adb mDNS (up to 15s)..."
for i in $(seq 1 15); do
  # _adb-tls-connect services advertise "<instance> <type> <ip>:<port>"
  ADDR=$("$ADB" mdns services 2>/dev/null | awk '/_adb-tls-connect/ {print $NF; exit}')
  if [ -n "$ADDR" ]; then
    echo "Found: $ADDR"
    "$ADB" connect "$ADDR" && "$ADB" devices && restore_tunnels
    exit 0
  fi
  sleep 1
done

echo "Phone not found. Check that Wireless debugging is ON and both devices"
echo "are on the same Wi-Fi, then re-run. If it still fails, read the IP:port"
echo "from the Wireless debugging screen and run:  $0 IP:PORT"
exit 1
