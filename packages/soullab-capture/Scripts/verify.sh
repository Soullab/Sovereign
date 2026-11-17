#!/bin/bash
# Soullab Capture — J2 offline verification. No microphone, no system-audio permission,
# no network, no installs. Run from packages/soullab-capture.
#
#   T17  strict Swift 6 build of every target with warnings as errors (debug and release)
#   T15  the release helper links no networking framework and references no client-side
#        socket or name-resolution symbol; the debug-only synthetic source is absent
#   T1–T20 swift test, plus the Node client contract tests
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== T17: strict builds (warnings are errors)"
swift build --build-tests -Xswiftc -warnings-as-errors 2>&1 | tail -1
swift build -c release --product soullab-capture-helper -Xswiftc -warnings-as-errors 2>&1 | tail -1

HELPER="$(swift build -c release --show-bin-path)/soullab-capture-helper"
echo "== T15: release helper linkage ($HELPER)"
LINKED="$(otool -L "$HELPER" | tail -n +2)"
echo "$LINKED" | sed 's/^/   /'
if echo "$LINKED" | grep -Eiq 'Network\.framework|CFNetwork|WebKit'; then
  echo "FAIL: networking framework linked"; exit 1
fi
UNDEFINED="$(nm -u "$HELPER")"
for sym in _connect _connectx _getaddrinfo _gethostbyname _sendto '_OBJC_CLASS_$_NSURLSession' 'URLSession' 'NWConnection'; do
  if echo "$UNDEFINED" | grep -Fq -- "$sym"; then
    if [ "$sym" = "_connect" ] && ! echo "$UNDEFINED" | grep -Eq '^_connect$'; then continue; fi
    echo "FAIL: release helper references $sym"; exit 1
  fi
done
if nm "$HELPER" | grep -q 'SyntheticSource'; then
  echo "FAIL: synthetic source compiled into release"; exit 1
fi
echo "   OK: no networking linkage or client socket symbols; no synthetic source in release"

echo "== T1–T20: swift test"
swift test --skip-build 2>&1 | grep -E "Executed [0-9]+ tests" | tail -1

echo "== Node client contract tests"
node --test --test-timeout=60000 js/captureClient.test.mjs 2>&1 | grep -E "^# (tests|pass|fail)"
