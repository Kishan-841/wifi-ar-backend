#!/bin/bash
# Reconnect the Moto G84 over wireless adb without needing to read the port
# from the phone. Requires: Wireless debugging toggled ON on the phone
# (Settings -> Developer options -> Wireless debugging) and same Wi-Fi network.
#
# Usage:  ./tools/connect-phone.sh            (auto-discover via mDNS)
#         ./tools/connect-phone.sh IP:PORT    (connect to an explicit address)

ADB="$HOME/Library/Android/sdk/platform-tools/adb"

if [ -n "$1" ]; then
  "$ADB" connect "$1"
  exit $?
fi

echo "Searching for the phone via adb mDNS (up to 15s)..."
for i in $(seq 1 15); do
  # _adb-tls-connect services advertise "<instance> <type> <ip>:<port>"
  ADDR=$("$ADB" mdns services 2>/dev/null | awk '/_adb-tls-connect/ {print $NF; exit}')
  if [ -n "$ADDR" ]; then
    echo "Found: $ADDR"
    "$ADB" connect "$ADDR" && "$ADB" devices
    exit 0
  fi
  sleep 1
done

echo "Phone not found. Check that Wireless debugging is ON and both devices"
echo "are on the same Wi-Fi, then re-run. If it still fails, read the IP:port"
echo "from the Wireless debugging screen and run:  $0 IP:PORT"
exit 1
