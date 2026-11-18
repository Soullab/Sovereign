// A tsc run that did not complete must never read as a verdict on the code.
// Evidence: Actions runs 44307064312 and 44314446622 (attempt 1) reported
// "program files : 0" and "COVERAGE LOST (4810)"; identical code then passed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  EXIT_INFRASTRUCTURE,
  TSC_HEAP_LIMIT_MB,
  TscInfrastructureError,
  assessTscRun,
  assertProgramListed,
  reportInfrastructureFailure,
  tscEnv,
} = require('./check-typehealth-baseline.js');

const isInfrastructure = (err) => err instanceof TscInfrastructureError;
const DIAGNOSTIC = "app/a.ts(1,1): error TS2322: Type 'string' is not assignable to type 'number'.\n";

test('a process really killed by a signal is an infrastructure failure', () => {
  const res = spawnSync(process.execPath, ['-e', 'process.kill(process.pid, "SIGKILL")'], {
    encoding: 'utf8',
  });
  assert.equal(res.signal, 'SIGKILL');
  assert.throws(() => assessTscRun(res), (err) => isInfrastructure(err) && /killed by SIGKILL/.test(err.reason));
});

test('a process that could not start is an infrastructure failure', () => {
  const res = spawnSync('/nonexistent/tsc-binary', [], { encoding: 'utf8' });
  assert.ok(res.error);
  assert.throws(() => assessTscRun(res), (err) => isInfrastructure(err) && /could not run/.test(err.reason));
});

test('an abnormal exit is an infrastructure failure even with diagnostics printed', () => {
  assert.throws(
    () => assessTscRun({ status: 134, signal: null, stdout: DIAGNOSTIC, stderr: 'FATAL ERROR' }),
    isInfrastructure
  );
});

test('a missing exit status is an infrastructure failure', () => {
  assert.throws(() => assessTscRun({ status: null, signal: null, stdout: '', stderr: '' }), isInfrastructure);
});

for (const status of [1, 2]) {
  test(`exit ${status} with no diagnostic is an infrastructure failure`, () => {
    assert.throws(
      () => assessTscRun({ status, signal: null, stdout: '', stderr: 'npm error could not determine executable' }),
      isInfrastructure
    );
  });

  test(`exit ${status} with a diagnostic stays a real verdict`, () => {
    assert.equal(assessTscRun({ status, signal: null, stdout: DIAGNOSTIC, stderr: '' }), DIAGNOSTIC);
  });
}

test('a clean tsc run returns its output', () => {
  assert.equal(assessTscRun({ status: 0, signal: null, stdout: '/repo/app/a.ts\n', stderr: '' }), '/repo/app/a.ts\n');
});

test('an empty program is an infrastructure failure, not lost coverage', () => {
  assert.throws(() => assertProgramListed(new Set(), ''), isInfrastructure);
});

test('a listed program passes through unchanged', () => {
  const paths = new Set(['app/a.ts']);
  assert.equal(assertProgramListed(paths, ''), paths);
});

test('the report exits 3, keeps the tsc output and forbids re-baselining', () => {
  const lines = [];
  const err = new TscInfrastructureError('tsc was killed by SIGKILL', 'FATAL ERROR: heap out of memory\n');
  const code = reportInfrastructureFailure(err, (line) => lines.push(line));
  const text = lines.join('\n');

  assert.equal(code, EXIT_INFRASTRUCTURE);
  assert.equal(EXIT_INFRASTRUCTURE, 3);
  assert.match(text, /INFRASTRUCTURE FAILURE/);
  assert.match(text, /heap out of memory/);
  assert.match(text, /Do NOT re-baseline/);
});

test('only the last lines of tsc output are kept', () => {
  const output = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
  const err = new TscInfrastructureError('tsc crashed', output);
  const kept = err.outputTail.split('\n');

  assert.equal(kept.length, 40);
  assert.equal(kept.at(-1), 'line 99');
});

// Evidence: Actions job 135047416760 crashed with "JavaScript heap out of memory"
// near 2 GB. tsc needs about 3.9 GB for this program.
test('the heap limit leaves room above the measured 3.9 GB peak', () => {
  assert.ok(TSC_HEAP_LIMIT_MB >= 5120, `limit ${TSC_HEAP_LIMIT_MB} MB is too close to the peak`);
  assert.ok(TSC_HEAP_LIMIT_MB < 16384, `limit ${TSC_HEAP_LIMIT_MB} MB exceeds runner memory`);
});

test('tsc gets the heap limit when none is set', () => {
  const env = tscEnv({ PATH: '/bin' });
  assert.equal(env.NODE_OPTIONS, `--max-old-space-size=${TSC_HEAP_LIMIT_MB}`);
  assert.equal(env.PATH, '/bin');
  assert.equal(env.FORCE_COLOR, '0');
});

test('other Node options are kept alongside the heap limit', () => {
  const env = tscEnv({ NODE_OPTIONS: '--trace-warnings' });
  assert.equal(env.NODE_OPTIONS, `--trace-warnings --max-old-space-size=${TSC_HEAP_LIMIT_MB}`);
});

for (const explicit of ['--max-old-space-size=8192', '--max_old_space_size=8192']) {
  test(`an explicit ${explicit} is respected`, () => {
    assert.equal(tscEnv({ NODE_OPTIONS: explicit }).NODE_OPTIONS, explicit);
  });
}

test('the caller environment is not modified', () => {
  const base = { NODE_OPTIONS: '--trace-warnings' };
  tscEnv(base);
  assert.deepEqual(base, { NODE_OPTIONS: '--trace-warnings' });
});

test('a real child process receives the larger heap', () => {
  const { NODE_OPTIONS: _ignored, ...parentEnv } = process.env;
  const res = spawnSync(
    process.execPath,
    ['-p', 'Math.round(require("v8").getHeapStatistics().heap_size_limit / 1048576)'],
    { encoding: 'utf8', env: tscEnv(parentEnv) }
  );
  assert.equal(res.status, 0, res.stderr);
  assert.ok(Number(res.stdout) >= TSC_HEAP_LIMIT_MB, `child heap limit was ${res.stdout.trim()} MB`);
});
