/**
 * E1LC SAMPLER — constitutional falsifiers (SLC-1 … SLC-9).
 *
 * ADDITIVE LAW. These govern `sampleLocalCapacity` — the SENSOR. They do not
 * touch LC-1…LC-8, which govern `evaluateLocalCapacity` — the JUDGE — and which
 * remain frozen under tests/constitutional/jarvis-o5-r3-runtime-binding/.
 *
 * WHY THIS ADDRESS EXISTS
 *   Every LC law passes a synthetic sample straight into the judge. Not one
 *   calls the sampler, so the number the judge is handed on a real host has
 *   never been governed. On Darwin the sampler returns Node's os.freemem(),
 *   which counts only genuinely free pages; macOS keeps that near zero by
 *   design and holds the rest as cache. Observed on a 48 GiB host:
 *   os.freemem() = 0.3 GiB while actual available = 15.8 GiB — a 50x gap.
 *   The Linux branch already reads MemAvailable, the correct concept. Darwin
 *   never got that treatment.
 *
 * THE HAZARD RUNS BOTH WAYS. Reading "available" must never admit a launch that
 * then thrashes. Compressed and wired pages are NOT reclaimable at speed and
 * must not be counted. A sampler that over-reports is worse than one that
 * under-reports, because the judge has no way to know it was lied to.
 */
import assert from 'node:assert/strict';

const PAGE = 16384;                       // Apple Silicon page size
export const pages = (n) => Math.round(n);

/** A realistic `vm_stat` body for a 48 GiB host under load. */
export function vmStatText({
  free = 20000,            // ~0.3 GiB  — what os.freemem() approximates
  active = 1200000,
  inactive = 900000,       // ~13.7 GiB — reclaimable
  speculative = 60000,     // ~0.9 GiB  — reclaimable
  throttled = 0,
  wired = 700000,          // NOT reclaimable
  purgeable = 80000,       // ~1.2 GiB  — reclaimable
  compressor = 400000,     // NOT reclaimable at speed
} = {}) {
  return [
    `Mach Virtual Memory Statistics: (page size of ${PAGE} bytes)`,
    `Pages free:                               ${free}.`,
    `Pages active:                             ${active}.`,
    `Pages inactive:                           ${inactive}.`,
    `Pages speculative:                        ${speculative}.`,
    `Pages throttled:                          ${throttled}.`,
    `Pages wired down:                         ${wired}.`,
    `Pages purgeable:                          ${purgeable}.`,
    `"Translation faults":                     123456789.`,
    `Pages occupied by compressor:             ${compressor}.`,
    '',
  ].join('\n');
}

const SWAP = 'total = 4096.00M  used = 1024.00M  free = 3072.00M  (encrypted)';
const TOTAL = 48 * 1024 ** 3;
const OS_FREEMEM = 20000 * PAGE;          // what Node reports: ~0.3 GiB

/** Reclaimable-by-definition: free + inactive + speculative + purgeable. */
export const EXPECTED_AVAILABLE = (20000 + 900000 + 60000 + 80000) * PAGE;

/** deps that make the sampler deterministic and host-independent. */
export function darwinDeps({ vmStat = vmStatText(), swap = SWAP, throwOn = null } = {}) {
  return {
    platform: 'darwin',
    totalmem: () => TOTAL,
    freemem: () => OS_FREEMEM,
    readFileSync: () => { throw new Error('linux path must not be used on darwin'); },
    execFileSync: (bin, args) => {
      const what = String(args?.[1] ?? '');
      if (throwOn === 'vm_stat' && /vm_stat|vm\.pageout/.test(bin + what)) throw new Error('vm_stat unavailable');
      if (/vm_stat/.test(bin)) return vmStat;
      if (what === 'vm.swapusage') {
        if (throwOn === 'swap') throw new Error('swap unavailable');
        return swap;
      }
      throw new Error(`unexpected exec: ${bin} ${args}`);
    },
  };
}

export const LAWS = Object.freeze({
  /** SLC-1 — darwin must consult vm_stat rather than returning os.freemem().
   *
   *  Deliberately NOT an exact-value assertion. An exact check is not a single
   *  proposition — it is "the whole computation is right", which every wrong
   *  sampler fails, making the law broad and the matrix undiscriminating. What
   *  belongs here is only the discriminating property: the number is derived
   *  from vm_stat, not from Node's free-page count. Which pages count, and at
   *  what page size, are SLC-2/3/4/7. */
  'SLC-1-darwin-reports-available-not-free': (S) => {
    const s = S.sampleLocalCapacity(darwinDeps());
    assert.equal(s.platform, 'darwin');
    assert.notEqual(s.free_ram_bytes, OS_FREEMEM,
      'darwin must not return os.freemem(): that is the defect this law exists to kill');
    assert.ok(s.free_ram_bytes > OS_FREEMEM * 10,
      'reclaimable memory on this fixture is far above the free-page count');
  },

  /** SLC-2 — compressed pages are not reclaimable at speed. Counting them
   *  over-admits and lets a model launch that then thrashes. */
  'SLC-2-compressor-not-counted': (S) => {
    const a = S.sampleLocalCapacity(darwinDeps({ vmStat: vmStatText({ compressor: 400000 }) }));
    const b = S.sampleLocalCapacity(darwinDeps({ vmStat: vmStatText({ compressor: 2000000 }) }));
    assert.equal(a.free_ram_bytes, b.free_ram_bytes,
      'compressor pages must not change available memory');
  },

  /** SLC-3 — wired and active pages are in use and must never be counted. */
  'SLC-3-wired-and-active-not-counted': (S) => {
    const a = S.sampleLocalCapacity(darwinDeps());
    const b = S.sampleLocalCapacity(darwinDeps({ vmStat: vmStatText({ wired: 1400000, active: 2400000 }) }));
    assert.equal(a.free_ram_bytes, b.free_ram_bytes,
      'wired/active pages must not change available memory');
  },

  /** SLC-4 — available can never be total. A sampler that returns total memory
   *  admits every launch on any host that clears the physical floor. */
  'SLC-4-available-is-never-total': (S) => {
    const s = S.sampleLocalCapacity(darwinDeps());
    assert.ok(s.free_ram_bytes < s.total_ram_bytes,
      'available must be strictly less than total on a loaded host');
  },

  /** SLC-5 — unreadable input FAILS CLOSED to null, by any route.
   *
   *  One law, not two. A throw and unparseable output are two ways of reaching
   *  the same decision: the sampler does not know. Splitting them produced two
   *  laws that each killed the other's candidate, because "falls back to
   *  freemem" and "coerces to zero" are one wrong decision wearing two values.
   *  null is what routes the judge to LOCAL_CAPACITY_SAMPLE_UNKNOWN; any number
   *  routes it to the wrong refusal and misreports why the host was held. */
  'SLC-5-unreadable-fails-closed': (S) => {
    const thrown = S.sampleLocalCapacity(darwinDeps({ throwOn: 'vm_stat' }));
    assert.equal(thrown.free_ram_bytes, null,
      'an unreadable vm_stat must yield null, never a fallback number');
    for (const junk of ['', 'not vm_stat output', 'Mach Virtual Memory Statistics:\n']) {
      const s = S.sampleLocalCapacity(darwinDeps({ vmStat: junk }));
      assert.equal(s.free_ram_bytes, null,
        `junk vm_stat (${JSON.stringify(junk.slice(0, 20))}) must yield null, never 0`);
    }
  },

  /** SLC-7 — the page size is read from the output, never assumed.
   *
   *  Expressed as a RATIO, not an absolute value, for the reason SLC-1 states:
   *  an exact assertion would also fail every candidate that counts a different
   *  page set, which is SLC-2/3/4's business. Holding the page counts fixed and
   *  quartering only the declared page size must quarter the result, whatever
   *  set of pages the sampler chose to count. */
  'SLC-7-page-size-read-not-assumed': (S) => {
    const big = S.sampleLocalCapacity(darwinDeps());
    const smallText = vmStatText().replace(`page size of ${PAGE} bytes`, 'page size of 4096 bytes');
    const small = S.sampleLocalCapacity(darwinDeps({ vmStat: smallText }));
    assert.ok(Number.isFinite(big.free_ram_bytes) && Number.isFinite(small.free_ram_bytes),
      'both samples must produce a number for the ratio to mean anything');
    assert.equal(small.free_ram_bytes * 4, big.free_ram_bytes,
      'quartering the declared page size must quarter the reported bytes');
  },

  /** SLC-8 — the Linux branch is untouched: it still reads MemAvailable. */
  'SLC-8-linux-branch-unchanged': (S) => {
    const s = S.sampleLocalCapacity({
      platform: 'linux',
      totalmem: () => TOTAL,
      freemem: () => OS_FREEMEM,
      execFileSync: () => { throw new Error('darwin path must not be used on linux'); },
      readFileSync: () => [
        'MemTotal:       49152000 kB',
        'MemFree:          200000 kB',
        'MemAvailable:   30000000 kB',
        'SwapTotal:       4194304 kB',
        'SwapFree:        3145728 kB',
      ].join('\n'),
    });
    assert.equal(s.free_ram_bytes, 30000000 * 1024, 'linux must still read MemAvailable');
  },

  /** SLC-9 — swap standing survives the change. Unknown swap stays unknown so
   *  LC-7 keeps its meaning. */
  'SLC-9-swap-standing-preserved': (S) => {
    const ok = S.sampleLocalCapacity(darwinDeps());
    assert.ok(Number.isFinite(ok.swap_free_bytes), 'swap must be sampled when available');
    const unknown = S.sampleLocalCapacity(darwinDeps({ throwOn: 'swap' }));
    assert.equal(unknown.swap_free_bytes, null, 'unreadable swap must stay null');
  },
});

export const LAW_IDS = Object.freeze(Object.keys(LAWS));
