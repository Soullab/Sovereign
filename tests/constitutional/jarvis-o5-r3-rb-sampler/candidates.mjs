/**
 * E1LC SAMPLER — defeat candidates.
 *
 * Eight deliberately WRONG samplers. Each varies ONE decision on an otherwise
 * identical substrate, per the single-proposition rule: a combined mutant masks
 * clause-level defects.
 *
 * D1 is the SHIPPED DEFECT — the sampler as canonical has it today. It must die
 * on SLC-1, which is the whole point of this address existing.
 *
 * D2 and D3 are the over-admission hazards. They matter more than D1: a sampler
 * that under-reports refuses work, while one that over-reports launches an
 * 18.5 GB model onto a host that cannot hold it.
 */
const PAGE_RE = /page size of (\d+) bytes/;
const pagesOf = (text, label) => {
  const m = text.match(new RegExp(`${label}:\\s+(\\d+)\\.`));
  return m ? Number(m[1]) : null;
};
const pageSize = (text) => {
  const m = text.match(PAGE_RE);
  return m ? Number(m[1]) : null;
};

/** Shared scaffolding so candidates differ only in the available-memory decision. */
function makeSampler(availableFrom) {
  return function sampleLocalCapacity(deps = {}) {
    const platform = deps.platform;
    let totalRam = Number(deps.totalmem());
    let freeRam = Number(deps.freemem());
    let swapTotal = null;
    let swapFree = null;

    if (platform === 'darwin') {
      try {
        const swapText = deps.execFileSync('/usr/sbin/sysctl', ['-n', 'vm.swapusage'], {});
        const m = String(swapText).match(/total\s*=\s*([\d.]+)M.*free\s*=\s*([\d.]+)M/);
        if (m) { swapTotal = Number(m[1]) * 1024 ** 2; swapFree = Number(m[2]) * 1024 ** 2; }
      } catch { /* unknown stays unknown */ }
      freeRam = availableFrom(deps, totalRam, freeRam);
    } else if (platform === 'linux') {
      try {
        const text = String(deps.readFileSync('/proc/meminfo', 'utf8'));
        const kb = (k) => {
          const m = text.match(new RegExp(`^${k}:\\s+(\\d+) kB`, 'm'));
          return m ? Number(m[1]) * 1024 : null;
        };
        const t = kb('MemTotal'); const a = kb('MemAvailable');
        const st = kb('SwapTotal'); const sf = kb('SwapFree');
        if (Number.isFinite(t)) totalRam = t;
        if (Number.isFinite(a)) freeRam = a;
        if (Number.isFinite(st)) swapTotal = st;
        if (Number.isFinite(sf)) swapFree = sf;
      } catch { /* fall back */ }
    }

    return Object.freeze({
      version: 'E1LC-SAMPLE.v1',
      platform,
      total_ram_bytes: Number.isFinite(totalRam) ? totalRam : null,
      free_ram_bytes: Number.isFinite(freeRam) ? freeRam : null,
      swap_total_bytes: Number.isFinite(swapTotal) ? swapTotal : null,
      swap_free_bytes: Number.isFinite(swapFree) ? swapFree : null,
    });
  };
}

/** The conforming decision: reclaimable pages only, fail closed on any doubt. */
export function conformingAvailable(deps) {
  let text;
  try { text = String(deps.execFileSync('/usr/bin/vm_stat', [], {})); } catch { return null; }
  const ps = pageSize(text);
  if (!Number.isFinite(ps) || ps <= 0) return null;
  const free = pagesOf(text, 'Pages free');
  const inactive = pagesOf(text, 'Pages inactive');
  const speculative = pagesOf(text, 'Pages speculative');
  const purgeable = pagesOf(text, 'Pages purgeable');
  if (![free, inactive, speculative, purgeable].every(Number.isFinite)) return null;
  return (free + inactive + speculative + purgeable) * ps;
}

export const REFERENCE = Object.freeze({ sampleLocalCapacity: makeSampler(conformingAvailable) });

export const CANDIDATES = Object.freeze([
  {
    id: 'D1-os-freemem-SHIPPED-DEFECT',
    error: 'returns Node os.freemem() on darwin — counts only genuinely free pages',
    dies_on: 'SLC-1-darwin-reports-available-not-free',
    collateral: ['SLC-5-unreadable-fails-closed', 'SLC-7-page-size-read-not-assumed'],
    collateral_reason:
      'os.freemem() never reads vm_stat at all. It therefore cannot honour the page-size '
      + 'header, and it returns the same number whether vm_stat throws or is junk, so it '
      + 'cannot fail closed either. Narrowing further would require the candidate to read '
      + 'vm_stat, at which point it is no longer the shipped defect.',
    impl: Object.freeze({ sampleLocalCapacity: makeSampler((deps, total, free) => free) }),
  },
  {
    id: 'D2-returns-total-memory',
    error: 'reports total RAM as available — admits every launch above the physical floor',
    dies_on: 'SLC-4-available-is-never-total',
    collateral: ['SLC-5-unreadable-fails-closed', 'SLC-7-page-size-read-not-assumed'],
    collateral_reason:
      'returning total RAM never consults vm_stat, so this candidate cannot honour the '
      + 'page-size header and cannot fail closed when vm_stat is unreadable — it reports '
      + 'the same number regardless. Making it read vm_stat would stop it being the '
      + 'over-admission error it exists to model.',
    impl: Object.freeze({ sampleLocalCapacity: makeSampler((deps, total) => total) }),
  },
  {
    id: 'D3-counts-compressor-pages',
    error: 'counts compressed pages as reclaimable — over-admits onto a thrashing host',
    dies_on: 'SLC-2-compressor-not-counted',
    collateral: [],
    impl: Object.freeze({
      sampleLocalCapacity: makeSampler((deps) => {
        let text; try { text = String(deps.execFileSync('/usr/bin/vm_stat', [], {})); } catch { return null; }
        const ps = pageSize(text); if (!Number.isFinite(ps)) return null;
        const parts = ['Pages free', 'Pages inactive', 'Pages speculative', 'Pages purgeable',
          'Pages occupied by compressor'].map((l) => pagesOf(text, l));
        if (!parts.every(Number.isFinite)) return null;
        return parts.reduce((a, b) => a + b, 0) * ps;
      }),
    }),
  },
  {
    id: 'D4-counts-wired-and-active',
    error: 'counts wired and active pages — treats memory in use as available',
    dies_on: 'SLC-3-wired-and-active-not-counted',
    collateral: [],
    impl: Object.freeze({
      sampleLocalCapacity: makeSampler((deps) => {
        let text; try { text = String(deps.execFileSync('/usr/bin/vm_stat', [], {})); } catch { return null; }
        const ps = pageSize(text); if (!Number.isFinite(ps)) return null;
        const parts = ['Pages free', 'Pages inactive', 'Pages speculative', 'Pages purgeable',
          'Pages wired down', 'Pages active'].map((l) => pagesOf(text, l));
        if (!parts.every(Number.isFinite)) return null;
        return parts.reduce((a, b) => a + b, 0) * ps;
      }),
    }),
  },
  {
    id: 'D5-falls-back-to-freemem-on-error',
    error: 'silently falls back to os.freemem() when vm_stat fails — restores the defect',
    dies_on: 'SLC-5-unreadable-fails-closed',
    collateral: [],
    impl: Object.freeze({
      sampleLocalCapacity: makeSampler((deps, total, free) => {
        const v = conformingAvailable(deps);
        return v === null ? free : v;
      }),
    }),
  },
  {
    id: 'D6-unparseable-becomes-zero',
    error: 'coerces unparseable output to 0 — a number, so the judge reports the wrong refusal',
    dies_on: 'SLC-5-unreadable-fails-closed',
    collateral: [],
    impl: Object.freeze({
      sampleLocalCapacity: makeSampler((deps) => {
        const v = conformingAvailable(deps);
        return v === null ? 0 : v;
      }),
    }),
  },
  {
    id: 'D7-assumes-16k-page-size',
    error: 'hard-codes the Apple Silicon page size instead of reading the header',
    dies_on: 'SLC-7-page-size-read-not-assumed',
    collateral: [],
    impl: Object.freeze({
      sampleLocalCapacity: makeSampler((deps) => {
        let text; try { text = String(deps.execFileSync('/usr/bin/vm_stat', [], {})); } catch { return null; }
        const parts = ['Pages free', 'Pages inactive', 'Pages speculative', 'Pages purgeable']
          .map((l) => pagesOf(text, l));
        if (!parts.every(Number.isFinite)) return null;
        return parts.reduce((a, b) => a + b, 0) * 16384;
      }),
    }),
  },
  {
    id: 'D8-breaks-linux-branch',
    error: 'regresses linux to MemFree while repairing darwin',
    dies_on: 'SLC-8-linux-branch-unchanged',
    collateral: [],
    impl: Object.freeze({
      sampleLocalCapacity(deps = {}) {
        const base = makeSampler(conformingAvailable)(deps);
        if (deps.platform !== 'linux') return base;
        const text = String(deps.readFileSync('/proc/meminfo', 'utf8'));
        const m = text.match(/^MemFree:\s+(\d+) kB/m);
        return Object.freeze({ ...base, free_ram_bytes: m ? Number(m[1]) * 1024 : null });
      },
    }),
  },
]);
