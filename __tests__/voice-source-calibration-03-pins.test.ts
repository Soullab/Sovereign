import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const read = (path: string) => readFileSync(path, 'utf8');
const D = 'docs/programme/VOICE-2026/';

/**
 * SOURCE LEVEL-CALIBRATION-03 (founder-directed 2026-11-21).
 *
 * The 02 act measured L1 VP-on (5 of 5 passing) and then returned: the Mac's output
 * volume read 38, not 69, when the VP-off phase began. Nobody at the Mac changed it
 * and the cause is not known. 03 is the same act again, with one addition: the run
 * pin records the output volume and device throughout, and writes no level pin if
 * either moved.
 */
describe('SOURCE LEVEL-CALIBRATION-03 execution pins', () => {
  const preflight02 = read(`${D}SOURCE_LEVEL-CALIBRATION-02_PREFLIGHT_PIN_DRAFT_2026-11-19.sh`);
  const run02 = read(`${D}SOURCE_LEVEL-CALIBRATION-02_RUN_PIN_DRAFT_2026-11-19.sh`);
  const preflight = read(`${D}SOURCE_LEVEL-CALIBRATION-03_PREFLIGHT_PIN_DRAFT_2026-11-21.sh`);
  const run = read(`${D}SOURCE_LEVEL-CALIBRATION-03_RUN_PIN_DRAFT_2026-11-21.sh`);
  const design = read(`${D}SOURCE_LEVEL-CALIBRATION-03_DESIGN_2026-11-21.md`);

  const renamed = (s: string) =>
    s.replace(/CALIBRATION-02/g, 'CALIBRATION-03').replace(/source-level-calibration-02/g, 'source-level-calibration-03');

  const watchLines = () => {
    const lines = run.split('\n');
    const from = lines.indexOf('# VOLUME-WATCH-BEGIN');
    const to = lines.indexOf('# VOLUME-WATCH-END');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    return lines.slice(from, to + 1);
  };

  it('the preflight is the accepted 02 preflight under the new act name, and nothing else', () => {
    expect(preflight).toBe(renamed(preflight02));
    expect(preflight).toContain('SHA=07eec30533c2d50cb9efd5b97104e7ad4e567a9a');
    expect(preflight).toContain('ROOT="$HOME/voice-2026-witness/source-level-calibration-03"');
    expect(preflight).toContain('refuses: K00_DEVICE is not the approved iPhone');
    expect(preflight).toContain('# R2-IDENTITY-BEGIN');
    expect(preflight).not.toContain('CALIBRATION-02');
  });

  it('the run pin is the accepted 02 run pin plus the volume watch, and nothing else', () => {
    const block = new Set(watchLines());
    const kept = new Set(renamed(run02).split('\n'));
    const added = run.split('\n').filter((l) => !kept.has(l));
    for (const line of added) {
      expect(block.has(line) || /VOLUME-WATCH/.test(line) || /watch_verdict \| tee/.test(line)).toBe(true);
    }
    // Nothing from the 02 run pin was dropped or reordered.
    const without = run.split('\n').filter((l) => kept.has(l));
    expect(without.join('\n')).toBe(renamed(run02));
  });

  it('requires its own founder authority and has its own one-shot marker', () => {
    expect(run).toContain('[ "$AUTH" = FOUNDER-AUTHORIZED-SOURCE-LEVEL-CALIBRATION-03 ]');
    expect(run).toContain('ACT_MARK="$ROOT/act-invoked.txt"');
    expect(run).toContain('ROOT="$HOME/voice-2026-witness/source-level-calibration-03"');
    expect(run).not.toMatch(/export K00_EXEC_AUTHORITY|K00_EXEC_AUTHORITY=/);
    expect(run).not.toContain('CALIBRATION-02');
  });

  it('the watch starts after the marker and before the first level, and is stopped before any seal', () => {
    const marker = run.indexOf("printf 'SOURCE-LEVEL-CALIBRATION-03 INVOKED");
    const begin = run.indexOf('# VOLUME-WATCH-BEGIN');
    const ladder = run.indexOf('for LEVEL in L1 L2 L3; do');
    expect(begin).toBeGreaterThan(marker);
    expect(ladder).toBeGreaterThan(begin);
    const lines = run.split('\n');
    lines.forEach((l, i) => {
      if (l.includes('SHA256SUMS.act') && l.includes('xargs shasum')) {
        const before = lines.slice(0, i).reverse().find((x) => x.includes('stop_watch') && !x.includes('stop_watch(){') && !x.startsWith('trap'));
        expect(before).toBeTruthy();
      }
    });
    expect(run).toContain('trap stop_watch EXIT');
  });

  it('no level pin is written unless the watch verdict is constant', () => {
    const gate = run.indexOf("grep -q '^VOLUME_CONSTANT ' \"$RUNROOT/volume-watch-verdict.txt\" ||");
    const pin = run.indexOf("printf 'SOURCE-LEVEL-CALIBRATION-03 LEVEL PIN\\n'");
    expect(gate).toBeGreaterThan(-1);
    expect(pin).toBeGreaterThan(gate);
    expect(run.slice(gate, pin)).toContain('exit 12');
  });

  /** Runs the pin's own verdict function, lifted verbatim, over a watch file. */
  function verdict(rows: string[]) {
    const fn = watchLines().find((l) => l.startsWith('watch_verdict(){'));
    expect(fn).toBeTruthy();
    const dir = mkdtempSync(join(tmpdir(), 'cal03-watch-'));
    writeFileSync(join(dir, 'w.tsv'), rows.length ? `${rows.join('\n')}\n` : '');
    const r = spawnSync('bash', ['-c', `${fn}\nwatch_verdict`], { env: { PATH: process.env.PATH ?? '', WATCH: join(dir, 'w.tsv') }, encoding: 'utf8' });
    return r.stdout.trim();
  }
  const good = (t: number) => `${t}\toutput volume:69, input volume:missing value, alert volume:59, output muted:false\tMac Studio Speakers|`;

  it('watch verdict: constant volume on the built-in speakers passes', () => {
    expect(verdict([good(1), good(2), good(3)])).toBe('VOLUME_CONSTANT rows=3');
  });

  it('watch verdict negative: any drift, device change, mute, failed read or empty watch is refused', () => {
    const cases: Array<[string, string[]]> = [
      ['volume moved (the 02 failure)', [good(1), '2\toutput volume:38, input volume:missing value, alert volume:59, output muted:false\tMac Studio Speakers|', good(3)]],
      ['volume 690 is not 69', [good(1), '2\toutput volume:690, input volume:missing value, alert volume:59, output muted:false\tMac Studio Speakers|']],
      ['bluetooth took the output', [good(1), '2\toutput volume:69, input volume:missing value, alert volume:59, output muted:false\tB06Ultra|']],
      ['two default outputs', [good(1), '2\toutput volume:69, input volume:missing value, alert volume:59, output muted:false\tMac Studio Speakers|B06Ultra|']],
      ['muted', [good(1), '2\toutput volume:69, input volume:missing value, alert volume:59, output muted:true\tMac Studio Speakers|']],
      ['volume read failed', [good(1), '2\tVOLUME_READ_FAILED\tMac Studio Speakers|']],
      ['device read empty', [good(1), '2\toutput volume:69, input volume:missing value, alert volume:59, output muted:false\t']],
      ['truncated row', [good(1), '2\toutput volume:69, input volume:missing value, alert volume:59, output muted:false']],
    ];
    for (const [label, rows] of cases) {
      expect([label, verdict(rows).split(' ')[0]]).toEqual([label, 'VOLUME_DRIFT']);
    }
    expect(verdict([])).toBe('VOLUME_WATCH_EMPTY');
  });

  it('the watch only reads: it changes no volume and selects no device', () => {
    const block = watchLines().join('\n');
    expect(block).toContain("osascript -e 'get volume settings'");
    expect(block).not.toMatch(/set volume|SwitchAudioSource|defaults write|afplay|devicectl|xcodebuild/);
  });

  it('the design records what the 02 act did and did not establish', () => {
    expect(design).toContain('RETURNED · PHASE A L1 PASS 5/5 · PHASE B NOT RUN · NO LEVEL PIN');
    expect(design).toContain('output volume:38');
    expect(design).toContain('cause not established');
    expect(design).toContain('return, never adapt');
  });

  it('both 03 pin scripts are shell-syntax clean', () => {
    for (const f of ['SOURCE_LEVEL-CALIBRATION-03_PREFLIGHT_PIN_DRAFT_2026-11-21.sh', 'SOURCE_LEVEL-CALIBRATION-03_RUN_PIN_DRAFT_2026-11-21.sh']) {
      expect(() => execFileSync('bash', ['-n', `${D}${f}`], { stdio: 'pipe' })).not.toThrow();
    }
  });
});
