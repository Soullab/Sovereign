set -e
set -o pipefail

SHA=07eec30533c2d50cb9efd5b97104e7ad4e567a9a
SUBJECT_SHA=faf918b5c5b2cd85f8e8a6c9cbda8bc76df11ce8
ROOT="$HOME/voice-2026-witness/source-level-calibration-03"
case "$ROOT" in /tmp/*|/private/tmp/*|/var/folders/*|/private/var/folders/*|/Volumes/*) echo "evidence root must be durable" >&2; exit 2;; esac
PTR="$ROOT/preflight-current.txt"
ACT_MARK="$ROOT/act-invoked.txt"

test ! -e "$ACT_MARK"

AUTH="$(printenv K00_EXEC_AUTHORITY 2>/dev/null || true)"
[ "$AUTH" = FOUNDER-AUTHORIZED-SOURCE-LEVEL-CALIBRATION-03 ]
SAFETY_CONFIRMATION="$(printenv K00_CAL_OPERATOR_SAFETY 2>/dev/null || true)"
[ "$SAFETY_CONFIRMATION" = CONFIRMED ]

test -f "$PTR"
WT="$(sed -n '1p' "$PTR")"
PF="$(sed -n '2p' "$PTR")"
FIXTURE="$(sed -n '3p' "$PTR")"
FIXTURE_SHA="$(sed -n '4p' "$PTR")"
GEOMETRY="$(sed -n '5p' "$PTR")"
GEOMETRY_SHA="$(sed -n '6p' "$PTR")"

case "$WT" in "$ROOT"/worktree-$SHA-*) ;; *) echo "wrong worktree pointer" >&2; exit 2;; esac
case "$PF" in "$WT"/docs/programme/VOICE-2026/driver-ledger/SOURCE-LEVEL-CALIBRATION-03-preflight-*) ;; *) echo "wrong preflight pointer" >&2; exit 2;; esac

cd "$WT"
test "$(git rev-parse HEAD)" = "$SHA"
test -z "$(git status --porcelain -- scripts/witness ios/VoiceKernel ios/VoiceKernelHarness ios/VoiceKernelDriver __tests__/voice-source-calibration-01.test.ts)"
test -f "$PF/PREFLIGHT-CLEAN"
test -f "$PF/SHA256SUMS.preflight"
( cd "$PF" && shasum -a 256 -c SHA256SUMS.preflight >/dev/null )
test "$(shasum -a 256 "$FIXTURE" | awk '{print $1}')" = "$FIXTURE_SHA"
test "$(shasum -a 256 "$GEOMETRY" | awk '{print $1}')" = "$GEOMETRY_SHA"

PFSTAMP="$(basename "$PF" | sed 's/.*preflight-//')"
NOW="$(date -u +%s)"
PFSEC="$(date -u -j -f %Y%m%dT%H%M%SZ "$PFSTAMP" +%s)"
AGE=$((NOW - PFSEC))
test "$AGE" -ge 0
test "$AGE" -le 300

ACTSTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
( set -o noclobber; printf 'SOURCE-LEVEL-CALIBRATION-03 INVOKED %s implementation %s subject %s\n' "$ACTSTAMP" "$SHA" "$SUBJECT_SHA" > "$ACT_MARK" )

RUNROOT="$WT/docs/programme/VOICE-2026/driver-ledger/SOURCE-LEVEL-CALIBRATION-03-ACT-$ACTSTAMP"
mkdir -p "$RUNROOT"
cp "$ACT_MARK" "$RUNROOT/act-marker.txt"
printf 'implementation=%s\nsubject=%s\npreflight=%s\nfixtureSha256=%s\ngeometrySha256=%s\ngeometryDeclared=%s\noperatorSafety=%s\n'   "$SHA" "$SUBJECT_SHA" "$PF" "$FIXTURE_SHA" "$GEOMETRY_SHA" FRESH_AT_PREFLIGHT "$SAFETY_CONFIRMATION" > "$RUNROOT/act-identity.txt"
# VOLUME-WATCH-BEGIN
WATCH="$RUNROOT/volume-watch.tsv"
( while :; do printf '%s\t%s\t%s\n' "$(date -u +%s)" "$(osascript -e 'get volume settings' 2>/dev/null || echo VOLUME_READ_FAILED)" "$(system_profiler SPAudioDataType 2>/dev/null | awk '/^        [^ ].*:$/{n=$0} /Default Output Device: Yes/{gsub(/^ +|:$/,"",n); print n}' | tr '\n' '|')"; sleep 1; done ) > "$WATCH" 2>/dev/null &
WATCH_PID=$!
stop_watch(){ if [ -n "$WATCH_PID" ]; then kill "$WATCH_PID" 2>/dev/null || true; wait "$WATCH_PID" 2>/dev/null || true; WATCH_PID=""; fi; }
trap stop_watch EXIT
watch_verdict(){ awk -F'\t' 'NF!=3 || $2 !~ /^output volume:69, / || $2 !~ /output muted:false$/ || $3 != "Mac Studio Speakers|" {bad++} END{ if (NR<1) print "VOLUME_WATCH_EMPTY"; else if (bad) print "VOLUME_DRIFT rows=" NR " bad=" bad; else print "VOLUME_CONSTANT rows=" NR }' "$WATCH"; }
# VOLUME-WATCH-END

SELECTED=""
SELECTED_DIR=""
for LEVEL in L1 L2 L3; do
  OUT="$RUNROOT/$LEVEL.stdout"
  set +e
  K00_CAL_BATCH_AUTHORITY=BOUND bash scripts/witness/k00-source-calibration-batch.sh "$LEVEL" on 5 "$FIXTURE" "$FIXTURE_SHA" "$GEOMETRY" "$GEOMETRY_SHA" > "$OUT" 2>&1
  RC=$?
  set -e
  [ "$RC" -eq 0 ] || { printf 'LEVEL %s infrastructure/precondition return rc=%s\n' "$LEVEL" "$RC" | tee "$RUNROOT/RETURN"; exit "$RC"; }
  DIR="$(tail -1 "$OUT")"
  test -d "$DIR"
  test -f "$DIR/SHA256SUMS.calibration"
  printf '%s\t%s\t%s\n' "$LEVEL" "$DIR" "$(shasum -a 256 "$DIR/SHA256SUMS.calibration" | awk '{print $1}')" >> "$RUNROOT/populations.tsv"
  PASS="$(python3 - "$DIR/calibration-result.json" <<'PY'
import json,sys
print('yes' if json.load(open(sys.argv[1])).get('populationPass') else 'no')
PY
)"
  if [ "$PASS" = yes ]; then
    SELECTED="$LEVEL"
    SELECTED_DIR="$DIR"
    break
  fi
done

if [ -z "$SELECTED" ]; then
  stop_watch; watch_verdict > "$RUNROOT/volume-watch-verdict.txt"  # VOLUME-WATCH
  printf 'NO_LEVEL_PIN\nV1 remains 20 dB; no threshold change; no L4 authorized.\n' | tee "$RUNROOT/RESULT"
  ( cd "$RUNROOT" && find . -type f ! -name SHA256SUMS.act | LC_ALL=C sort | xargs shasum -a 256 ) > "$RUNROOT/SHA256SUMS.act"
  echo "SOURCE-LEVEL-CALIBRATION-03 COMPLETE NO_LEVEL_PIN $RUNROOT"
  exit 0
fi

case "$SELECTED" in
  L1) GAIN=0.285714; EFFECTIVE=0.20;;
  L2) GAIN=0.571429; EFFECTIVE=0.40;;
  L3) GAIN=1.000000; EFFECTIVE=0.70;;
esac

VPON_RESULT="$SELECTED_DIR/calibration-result.json"
VPOUT="$RUNROOT/$SELECTED-VP-OFF.stdout"
set +e
K00_CAL_BATCH_AUTHORITY=BOUND bash scripts/witness/k00-source-calibration-batch.sh "$SELECTED" off 3 "$FIXTURE" "$FIXTURE_SHA" "$GEOMETRY" "$GEOMETRY_SHA" "$VPON_RESULT" > "$VPOUT" 2>&1
VPRC=$?
set -e
[ "$VPRC" -eq 0 ] || { printf 'VP-OFF characterization infrastructure/precondition return rc=%s\n' "$VPRC" | tee "$RUNROOT/RETURN"; exit "$VPRC"; }
VPDIR="$(tail -1 "$VPOUT")"
test -d "$VPDIR"
test -f "$VPDIR/calibration-result.json"
printf 'VP-OFF\t%s\t%s\n' "$VPDIR" "$(shasum -a 256 "$VPDIR/SHA256SUMS.calibration" | awk '{print $1}')" >> "$RUNROOT/populations.tsv"

CHARACTERIZATION="$(python3 - "$VPDIR/calibration-result.json" <<'PY'
import json,sys
r=json.load(open(sys.argv[1]))
print(r.get('vpComparison',{}).get('characterization','MIXED_OR_INDETERMINATE'))
PY
)"
DELTA="$(python3 - "$VPDIR/calibration-result.json" <<'PY'
import json,sys
r=json.load(open(sys.argv[1]))
print(r.get('vpComparison',{}).get('deltaDb'))
PY
)"

stop_watch  # VOLUME-WATCH
watch_verdict | tee "$RUNROOT/volume-watch-verdict.txt"  # VOLUME-WATCH
grep -q '^VOLUME_CONSTANT ' "$RUNROOT/volume-watch-verdict.txt" || { printf 'VOLUME-WATCH: output volume or device changed during the act; no level pin is written\n' | tee "$RUNROOT/RETURN"; exit 12; }
{
  printf 'SOURCE-LEVEL-CALIBRATION-03 LEVEL PIN\n'
  printf 'selectedLevel=%s\n' "$SELECTED"
  printf 'masterPlaybackGain=%s\n' "$GAIN"
  printf 'nominalEffectivePeakFS=%s\n' "$EFFECTIVE"
  printf 'fixtureSha256=%s\n' "$FIXTURE_SHA"
  printf 'geometrySha256=%s\n' "$GEOMETRY_SHA"
  printf 'systemVolume=69\n'
  printf 'outputDevice=Mac Studio Speakers\n'
  printf 'vp=on\n'
  printf 'vpOnPopulation=%s\n' "$SELECTED_DIR"
  printf 'vpOffCharacterization=%s\n' "$VPDIR"
  printf 'vpCharacterization=%s\n' "$CHARACTERIZATION"
  printf 'vpDeltaDb=%s\n' "$DELTA"
  printf 'sourceReaderV1=UNCHANGED_20_DB\n'
  printf 'historicalSource03=UNMEASURED_FOREVER\n'
} | tee "$RUNROOT/SELECTED-SOURCE-PIN"

( cd "$RUNROOT" && find . -type f ! -name SHA256SUMS.act | LC_ALL=C sort | xargs shasum -a 256 ) > "$RUNROOT/SHA256SUMS.act"
echo "SOURCE-LEVEL-CALIBRATION-03 COMPLETE SELECTED $SELECTED $RUNROOT"
