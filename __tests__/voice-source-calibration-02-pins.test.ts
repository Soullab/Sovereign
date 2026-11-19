import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

  // PLAYER-IDENTITY AMENDMENT-01 (founder, 2026-11-19): the implementation the pins bind to.
  const AMENDED = '07eec30533c2d50cb9efd5b97104e7ad4e567a9a';
  const SEPTEMBER = '2f211f432394a236cc2bcdb4fea55ca1bd179713';
  const OLD_PLAYER = '88f3b577790877524edc79a20de8838a019c0ca723a0eaa4a8612a860317cabb';
  const NEW_PLAYER = '85d3ee1676edf279b42f80222235a45c0533a4121273a8ee47afee226230a0a4';

  it('binds to the amended implementation and the unchanged subject (R5, AMENDMENT-01)', () => {
    for (const pin of [preflight, run]) {
      expect(pin).toContain(`SHA=${AMENDED}`);
      expect(pin).toContain('SUBJECT_SHA=faf918b5c5b2cd85f8e8a6c9cbda8bc76df11ce8');
    }
  });

  it('keeps every frozen-tree and frozen-blob proof of the 01 preflight', () => {
    const proofs = preflight01.split('\n').filter((l) => /^test "\$\(git rev-parse "\$SHA:/.test(l));
    expect(proofs.length).toBe(10);
    for (const line of proofs) expect(preflight).toContain(line);
    for (const name of ['VOICEKERNEL_TREE', 'HARNESS_TREE', 'CAL_READER_BLOB', 'CAL_TEST_BLOB', 'FIXTURE_GENERATOR_BLOB', 'SOURCE_READER_BLOB', 'OUTPUT_READER_BLOB', 'ENTRY_READER_BLOB']) {
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
    expect(preflight).toContain(
      '[ "$DEV" = A0736AC8-793B-516F-AC72-C076DB6CEE38 ] || { echo "SOURCE-LEVEL-CALIBRATION-02 refuses: K00_DEVICE is not the approved iPhone" >&2; exit 2; }',
    );
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
    const allowed = /private\/tmp|CALIBRATION-01|GEOMETRY_CONFIRMATION|\[ -n "\$AUTH" \]|^SHA=|^DRIVER_BATCH_BLOB=|^CAL_BATCH_BLOB=|^AFPLAY_SHA=/;
    for (const line of removed(preflight01, preflight)) expect(line).toMatch(allowed);
    for (const line of removed(run01, run)) expect(line).toMatch(allowed);
    // And every added line is one of the ruled additions.
    const added = /ROOT|CALIBRATION-02|FOUNDER-AUTHORIZED|FRESH_AT_PREFLIGHT|geometryDeclared|xcode-version|iphoneos-sdk-version|macos-version|^SHA=|^DRIVER_BATCH_BLOB=|^CAL_BATCH_BLOB=|^AFPLAY_SHA=/;
    // Revision 1: the installed-identity block is the only other addition to the preflight.
    const block = new Set(identityBlock());
    for (const line of removed(preflight, preflight01)) {
      if (!block.has(line)) expect(line).toMatch(added);
    }
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

  // ── Revision 1 (review 2026-11-19): R2 installed identity, R3 device guard ──

  const INSTALL_RECORD = `${D}driver-ledger/VPIO-02-SID-FIRST-INSTALL-04-20260916T014705Z/out/apps-after-vpio02sid.json`;
  const BID = 'life.soullab.voicekernel.vpio02sid';
  const CONTAINER = '85948DBD-BA8F-4679-950D-31767B1C24E5';
  const APPROVED = 'A0736AC8-793B-516F-AC72-C076DB6CEE38';

  function identityBlock(): string[] {
    const lines = preflight.split('\n');
    const from = lines.indexOf('# R2-IDENTITY-BEGIN');
    const to = lines.indexOf('# R2-IDENTITY-END');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    return lines.slice(from, to + 1);
  }

  /** Runs the pin's own identity checker, lifted verbatim, against a device reading. */
  function runIdentity(mutate: (apps: any[]) => any[], record = INSTALL_RECORD) {
    const block = identityBlock();
    const py = block.slice(block.findIndex((l) => l.endsWith("<<'PY'")) + 1, block.lastIndexOf('PY')).join('\n');
    const dir = mkdtempSync(join(tmpdir(), 'cal02-identity-'));
    const reading = JSON.parse(read(INSTALL_RECORD));
    reading.result.apps = mutate(JSON.parse(JSON.stringify(reading.result.apps)));
    writeFileSync(join(dir, 'now.json'), JSON.stringify(reading));
    const r = spawnSync('python3', ['-', join(dir, 'now.json'), record, BID, CONTAINER], { input: py, encoding: 'utf8' });
    return { status: r.status, out: r.stdout };
  }

  /** Runs the pin's own device-selection lines, lifted verbatim. */
  function runDeviceGuard(env: Record<string, string>) {
    const lines = preflight.split('\n');
    const from = lines.findIndex((l) => l.startsWith('DEV="$(printenv K00_DEVICE'));
    const script = ['set -e', ...lines.slice(from, from + 3), 'printf "DEV=%s\\n" "$DEV"'].join('\n');
    const r = spawnSync('bash', ['-c', script], { env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' });
    return { status: r.status, out: r.stdout, err: r.stderr };
  }

  it('R3: the device guard uses the approved iPhone when unset and accepts it when named', () => {
    expect(runDeviceGuard({})).toMatchObject({ status: 0, out: `DEV=${APPROVED}\n` });
    expect(runDeviceGuard({ K00_DEVICE: '' })).toMatchObject({ status: 0, out: `DEV=${APPROVED}\n` });
    expect(runDeviceGuard({ K00_DEVICE: APPROVED })).toMatchObject({ status: 0, out: `DEV=${APPROVED}\n` });
  });

  it('R3 negative: any other device named in K00_DEVICE is refused before anything is written', () => {
    for (const other of ['00008140-00163D9922E0801C', 'A0736AC8-793B-516F-AC72-C076DB6CEE39', `${APPROVED} `, APPROVED.toLowerCase(), 'iPhone']) {
      const r = runDeviceGuard({ K00_DEVICE: other });
      expect(r.status).toBe(2);
      expect(r.out).toBe('');
      expect(r.err).toContain('not the approved iPhone');
    }
    const guard = preflight.indexOf('refuses: K00_DEVICE is not the approved iPhone');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(preflight.indexOf('mkdir -p "$ROOT"'));
    expect(guard).toBeLessThan(preflight.indexOf('xcrun devicectl'));
  });

  it('R2: a device reading equal to the committed install record passes, and says what it does not prove', () => {
    const r = runIdentity((apps) => apps);
    expect(r.status).toBe(0);
    expect(r.out).toContain('SID_INSTALLED_IDENTITY_MATCH True');
    expect(r.out).toContain('the installed executable is not hashed by this check');
  });

  it('R2 negative: every departure from the install record is refused', () => {
    const cases: Array<[string, (apps: any[]) => any[]]> = [
      ['reinstalled (new container)', (a) => [{ ...a[0], url: a[0].url.replace(CONTAINER, 'E3B88028-A10F-46B1-AB27-CF0A1F83FB78') }]],
      ['different version', (a) => [{ ...a[0], version: '0.0.2' }]],
      ['different build number', (a) => [{ ...a[0], bundleVersion: '2' }]],
      ['different display name', (a) => [{ ...a[0], name: 'VoiceKernel VPIO-02' }]],
      ['look-alike bundle id', (a) => [{ ...a[0], bundleIdentifier: `${BID}x` }]],
      ['not developer-built', (a) => [{ ...a[0], builtByDeveloper: false }]],
      ['app absent', () => []],
      ['listed twice', (a) => [a[0], a[0]]],
      ['pinned ids present only in stray fields', (a) => [{ bundleIdentifier: 'other.app', note: `${BID} ${CONTAINER}`, url: 'file:///x/' }]],
    ];
    for (const [label, mutate] of cases) {
      const r = runIdentity(mutate);
      expect([label, r.status]).toEqual([label, 1]);
      expect(r.out).toContain('SID_INSTALLED_IDENTITY_MATCH False');
      expect(r.out).toContain('REFUSE');
    }
  });

  it('R2: the install record itself is pinned by blob and read from the frozen implementation', () => {
    const block = identityBlock().join('\n');
    const blob = execFileSync('git', ['hash-object', INSTALL_RECORD], { encoding: 'utf8' }).trim();
    expect(block).toContain(`INSTALL_RECORD=${INSTALL_RECORD}`);
    expect(block).toContain(`INSTALL_RECORD_BLOB=${blob}`);
    expect(block).toContain('test "$(git rev-parse "$SHA:$INSTALL_RECORD")" = "$INSTALL_RECORD_BLOB"');
    expect(block).not.toMatch(/devicectl|xcodebuild/);
    // The stricter check runs after the 01 check and before the process read; the 01 check is kept.
    const old = preflight.indexOf('print("SID_APP_CONTAINER_MATCH",ok)');
    const strict = preflight.indexOf('# R2-IDENTITY-BEGIN');
    expect(strict).toBeGreaterThan(old);
    expect(strict).toBeLessThan(preflight.indexOf('xcrun devicectl device info processes'));
  });

  // ── PLAYER-IDENTITY AMENDMENT-01 ──

  const gitBlob = (content: string) => {
    const body = Buffer.from(content, 'utf8');
    return createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
  };
  const pinned = (src: string, name: string) => (src.split('\n').find((l) => l.startsWith(`${name}=`)) ?? '').split('=')[1];

  it('AMENDMENT-01: each batch script differs from its September blob by the player hash and nothing else', () => {
    for (const [file, name] of [
      ['scripts/witness/k00-source-calibration-batch.sh', 'CAL_BATCH_BLOB'],
      ['scripts/witness/k00-driver-batch.sh', 'DRIVER_BATCH_BLOB'],
    ]) {
      const now = read(file);
      expect(now.split(NEW_PLAYER).length - 1).toBe(1);
      expect(now).not.toContain(OLD_PLAYER);
      // The file as it stands is what the 02 preflight pins…
      expect(gitBlob(now)).toBe(pinned(preflight, name));
      // …and putting the old hash back reproduces the September blob exactly.
      expect(gitBlob(now.replace(NEW_PLAYER, OLD_PLAYER))).toBe(pinned(preflight01, name));
    }
  });

  it('AMENDMENT-01: the preflight pins the same player the batch pins, and records the macOS version', () => {
    expect(preflight).toContain(`AFPLAY_SHA=${NEW_PLAYER}`);
    expect(read('scripts/witness/k00-source-calibration-batch.sh')).toContain(`AFPLAY_SHA=${NEW_PLAYER}`);
    expect(preflight01).toContain(`AFPLAY_SHA=${OLD_PLAYER}`);
    expect(preflight).toContain('sw_vers > "$PF/macos-version.txt"');
    expect(AMENDED).not.toBe(SEPTEMBER);
    for (const pin of [preflight, run]) expect(pin).not.toContain(SEPTEMBER);
  });

  it('both 02 pin scripts are shell-syntax clean', () => {
    for (const f of ['SOURCE_LEVEL-CALIBRATION-02_PREFLIGHT_PIN_DRAFT_2026-11-19.sh', 'SOURCE_LEVEL-CALIBRATION-02_RUN_PIN_DRAFT_2026-11-19.sh']) {
      expect(() => execFileSync('bash', ['-n', `${D}${f}`], { stdio: 'pipe' })).not.toThrow();
    }
  });
});
