import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const D = 'docs/programme/VOICE-2026/';

/**
 * SOURCE LEVEL-CALIBRATION-02 (founder-adjudicated 2026-11-19).
 *
 * The 01 act lost its evidence root because it lived under the system temporary
 * directory. These tests pin the only things 02 is allowed to change, and prove
 * that every frozen line of the 01 pins carried over unchanged.
 */
describe('SOURCE LEVEL-CALIBRATION-02 execution pins', () => {
  const preflight01 = read(`${D}SOURCE_LEVEL-CALIBRATION-01_PREFLIGHT_PIN_DRAFT_2026-09-21.sh`);
  const run01 = read(`${D}SOURCE_LEVEL-CALIBRATION-01_RUN_PIN_DRAFT_2026-09-21.sh`);
  const preflight = read(`${D}SOURCE_LEVEL-CALIBRATION-02_PREFLIGHT_PIN_DRAFT_2026-11-19.sh`);
  const run = read(`${D}SOURCE_LEVEL-CALIBRATION-02_RUN_PIN_DRAFT_2026-11-19.sh`);
  const design = read(`${D}SOURCE_LEVEL-CALIBRATION-02_DESIGN_2026-11-19.md`);

  const removed = (a: string, b: string) => {
    const kept = new Set(b.split('\n'));
    return a.split('\n').filter((line) => !kept.has(line));
  };

  it('binds to the unchanged implementation and subject (R5)', () => {
    for (const pin of [preflight, run]) {
      expect(pin).toContain('SHA=2f211f432394a236cc2bcdb4fea55ca1bd179713');
      expect(pin).toContain('SUBJECT_SHA=faf918b5c5b2cd85f8e8a6c9cbda8bc76df11ce8');
    }
  });

  it('keeps every frozen-tree and frozen-blob proof of the 01 preflight', () => {
    const proofs = preflight01.split('\n').filter((l) => /^test "\$\(git rev-parse "\$SHA:/.test(l));
    expect(proofs.length).toBe(10);
    for (const line of proofs) expect(preflight).toContain(line);
    for (const name of ['VOICEKERNEL_TREE', 'HARNESS_TREE', 'CAL_BATCH_BLOB', 'CAL_READER_BLOB', 'AFPLAY_SHA']) {
      const pinned = preflight01.split('\n').find((l) => l.startsWith(`${name}=`));
      expect(pinned).toBeTruthy();
      expect(preflight).toContain(pinned as string);
    }
  });

  it('keeps the evidence root durable and refuses any temporary directory (C2, R1)', () => {
    for (const pin of [preflight, run]) {
      expect(pin).toContain('ROOT="$HOME/voice-2026-witness/source-level-calibration-02"');
      expect(pin).toContain(
        'case "$ROOT" in /tmp/*|/private/tmp/*|/var/folders/*|/private/var/folders/*|/Volumes/*) echo "evidence root must be durable" >&2; exit 2;; esac',
      );
      const outsideGuard = pin.split('\n').filter((l) => !l.startsWith('case "$ROOT" in '));
      expect(outsideGuard.join('\n')).not.toMatch(/\/private\/tmp|\/tmp\/|mktemp|TMPDIR/);
    }
    expect(preflight).toContain('WT="$ROOT/worktree-$SHA-$STAMP"');
    expect(preflight).toContain('PTR="$ROOT/preflight-current.txt"');
    expect(run).toContain('ACT_MARK="$ROOT/act-invoked.txt"');
    expect(run).toContain('case "$WT" in "$ROOT"/worktree-$SHA-*)');
  });

  it('depends on no prior act and no claim of unchanged geometry (C4, C5)', () => {
    expect(run).not.toMatch(/PRIOR_|RETRY|K00_CAL_RETRY_BASIS|K00_CAL_GEOMETRY_CONFIRMATION/);
    expect(run).not.toMatch(/=\s*UNCHANGED\s*\]/);
    expect(run).toContain('FRESH_AT_PREFLIGHT');
    for (const v of ['K00_CAL_PHONE_ORIENTATION', 'K00_CAL_PHONE_MIC_EDGE', 'K00_CAL_DISTANCE_CM', 'K00_CAL_SUPPORT', 'K00_CAL_ROOM_STATE']) {
      expect(preflight).toContain(v);
    }
    // Geometry is declared at preflight and the run must start within five minutes of it.
    expect(run).toContain('test "$AGE" -le 300');
  });

  it('requires the exact founder authority and operator safety before spending its marker (R4)', () => {
    const auth = run.indexOf('[ "$AUTH" = FOUNDER-AUTHORIZED-SOURCE-LEVEL-CALIBRATION-02 ]');
    const safety = run.indexOf('[ "$SAFETY_CONFIRMATION" = CONFIRMED ]');
    const marker = run.indexOf("printf 'SOURCE-LEVEL-CALIBRATION-02 INVOKED");
    expect(auth).toBeGreaterThan(-1);
    expect(safety).toBeGreaterThan(auth);
    expect(marker).toBeGreaterThan(safety);
    expect(run).toContain('test ! -e "$ACT_MARK"');
    expect(run).toContain('set -o noclobber');
    // The pin reads authority from the environment; it never sets it.
    expect(run).not.toMatch(/export K00_EXEC_AUTHORITY|K00_EXEC_AUTHORITY=/);
    expect(preflight).not.toMatch(/K00_EXEC_AUTHORITY/);
  });

  it('keeps the same phone, the same organism identity and a read-only device check (R2, R3)', () => {
    for (const line of [
      '[ -n "$DEV" ] || DEV=A0736AC8-793B-516F-AC72-C076DB6CEE38',
      'BID=life.soullab.voicekernel.vpio02sid',
      'SID_CONTAINER=85948DBD-BA8F-4679-950D-31767B1C24E5',
    ]) {
      expect(preflight01).toContain(line);
      expect(preflight).toContain(line);
    }
    expect(preflight).toContain('print("SID_APP_CONTAINER_MATCH",ok)');
    expect(preflight).not.toMatch(/devicectl device (install|process launch|process terminate|uninstall)/);
    expect(preflight).not.toMatch(/xcodebuild (build|test)|afplay -v/);
  });

  it('keeps Mac Studio Speakers at volume 69 and the closed first-pass-wins ladder with no L4', () => {
    expect(preflight).toContain("defaults[0].get('_name')=='Mac Studio Speakers'");
    expect(preflight).toContain("grep -q 'output volume:69,'");
    expect(run).toContain('for LEVEL in L1 L2 L3; do');
    expect(run).not.toMatch(/\bL4\b(?! authorized)/);
    expect(run).toContain("no L4 authorized");
    expect(run).toContain('scripts/witness/k00-source-calibration-batch.sh "$LEVEL" on 5');
    expect(run).toContain('L1) GAIN=0.285714; EFFECTIVE=0.20;;');
    expect(run).toContain('L2) GAIN=0.571429; EFFECTIVE=0.40;;');
    expect(run).toContain('L3) GAIN=1.000000; EFFECTIVE=0.70;;');
    expect(run).toContain("printf 'sourceReaderV1=UNCHANGED_20_DB\\n'");
  });

  it('runs VP-off only after a VP-on level pin exists', () => {
    const noPin = run.indexOf('NO_LEVEL_PIN');
    const vpOff = run.indexOf('"$SELECTED" off 3');
    expect(noPin).toBeGreaterThan(-1);
    expect(vpOff).toBeGreaterThan(noPin);
  });

  it('records the toolchain it ran under (C6)', () => {
    expect(preflight).toContain('xcodebuild -version > "$PF/xcode-version.txt"');
    expect(preflight).toContain('xcrun --sdk iphoneos --show-sdk-version > "$PF/iphoneos-sdk-version.txt"');
  });

  it('changes nothing in the 01 pins beyond the ruled set', () => {
    // Every 01 line that did not carry over must be one of the ruled changes.
    const allowed = /private\/tmp|CALIBRATION-01|GEOMETRY_CONFIRMATION|\[ -n "\$AUTH" \]/;
    for (const line of removed(preflight01, preflight)) expect(line).toMatch(allowed);
    for (const line of removed(run01, run)) expect(line).toMatch(allowed);
    // And every added line is one of the ruled additions.
    const added = /ROOT|CALIBRATION-02|FOUNDER-AUTHORIZED|FRESH_AT_PREFLIGHT|geometryDeclared|xcode-version|iphoneos-sdk-version/;
    for (const line of removed(preflight, preflight01)) expect(line).toMatch(added);
    for (const line of removed(run, run01)) expect(line).toMatch(added);
  });

  it('the design records the adjudication and leaves the 01 act and retry untouched', () => {
    expect(design).toContain('DESIGN ADJUDICATED — founder act, 2026-11-19');
    expect(design).toContain('RETURNED · ZERO MEASUREMENT · EVIDENCE ROOT LOST');
    expect(design).toContain('RETIRED UNRUN');
    expect(design).toContain('return, never adapt');
    expect(read(`${D}SOURCE_LEVEL-CALIBRATION-01_RETRY-01_RUN_PIN_DRAFT_2026-09-21.sh`)).toContain(
      'FOUNDER-REAUTHORIZED-SOURCE-LEVEL-CALIBRATION-01-RETRY-01',
    );
  });

  it('both 02 pin scripts are shell-syntax clean', () => {
    for (const f of ['SOURCE_LEVEL-CALIBRATION-02_PREFLIGHT_PIN_DRAFT_2026-11-19.sh', 'SOURCE_LEVEL-CALIBRATION-02_RUN_PIN_DRAFT_2026-11-19.sh']) {
      expect(() => execFileSync('bash', ['-n', `${D}${f}`], { stdio: 'pipe' })).not.toThrow();
    }
  });
});
