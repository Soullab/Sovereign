'use client';

/**
 * Admin: Soullab Strategic Marketing Roadmap (proposal for review).
 *
 * The roadmap content is fetched from the admin-guarded API route and is never
 * bundled into this client file. Checkmarks and Studio statuses are planning
 * notes kept in this browser's localStorage only: they write nothing to the
 * server and authorize nothing.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardCopy, Map as MapIcon, Palette, RefreshCw } from 'lucide-react';
import { adminFetch } from '@/lib/admin/adminFetch';
import type { StrategicRoadmap } from '@/lib/marketing/strategicRoadmap2027';

type Payload = {
  standing: { status: 'proposal'; ratified: boolean; notice: string };
  roadmap: StrategicRoadmap;
};

const CHECKS_KEY = 'soullab_admin_marketing_plan_checks';
const STATUS_KEY = 'soullab_admin_marketing_studio_status';

const STATUS_OPTIONS = [
  { value: 'unassessed', label: 'Unassessed', cls: 'border-white/15 bg-white/[0.03]' },
  { value: 'preparing', label: 'Preparing', cls: 'border-amber-400/40 bg-amber-400/10' },
  { value: 'ready', label: 'Ready for gate review', cls: 'border-teal-400/40 bg-teal-400/10' },
  { value: 'active', label: 'Marked active', cls: 'border-emerald-400/40 bg-emerald-400/10' },
  { value: 'held', label: 'Held', cls: 'border-rose-400/40 bg-rose-400/10' },
] as const;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: planning notes simply are not kept */
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function Section({ num, title, note, children }: { num?: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        {num && <div className="font-mono text-xs text-teal-300">{num}</div>}
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {note && <p className="max-w-3xl text-sm text-white/55">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function PhaseBand({ label, title, note }: { label: string; title: string; note?: string }) {
  return (
    <div className="space-y-1 border-t border-white/10 pt-8">
      <div className="font-mono text-xs uppercase tracking-widest text-amber-300/80">{label}</div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {note && <p className="max-w-3xl text-sm text-white/55">{note}</p>}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.04] font-mono text-[11px] uppercase tracking-wider text-white/45">
          <tr>{head.map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-white/10 align-top">
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-2.5 ${j === 0 ? 'font-medium text-white' : 'text-white/70'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarketingRoadmapAdminPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [month, setMonth] = useState<'dec' | 'jan' | 'feb'>('dec');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const res = await adminFetch('/api/admin/marketing-roadmap', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) {
        setError('This page is for founder, CTO and operations admins. Sign in with one of those roles to view the roadmap.');
        setPhase('error');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setPayload((await res.json()) as Payload);
      setPhase('ready');
    } catch {
      setError('The roadmap could not be loaded just now. Try Refresh.');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    setChecks(loadJson(CHECKS_KEY, {}));
    setStatus(loadJson(STATUS_KEY, {}));
    void load();
  }, [load]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2500);
  };

  const rm = payload?.roadmap;
  const totalTasks = useMemo(
    () => (rm ? rm.plan.reduce((n, m) => n + m.weeks.reduce((k, w) => k + w.tasks.length, 0), 0) : 0),
    [rm],
  );
  const doneTasks = Object.values(checks).filter(Boolean).length;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (rm?.studios ?? []).forEach((s) => {
      const v = status[s] ?? 'unassessed';
      c[v] = (c[v] ?? 0) + 1;
    });
    return c;
  }, [rm, status]);

  const toggle = (id: string, value: boolean) => {
    const next = { ...checks, [id]: value };
    setChecks(next);
    saveJson(CHECKS_KEY, next);
  };
  const setStudio = (studio: string, value: string) => {
    const next = { ...status, [studio]: value };
    setStatus(next);
    saveJson(STATUS_KEY, next);
  };

  const copyPlan = async () => {
    if (!rm) return;
    const out = ["Soullab — Heather's 90-day working plan (proposal, not ratified)", ''];
    rm.plan.forEach((m) => {
      out.push(`${m.label.toUpperCase()} — ${m.title}${m.draft ? ' [draft to confirm]' : ''}`);
      m.weeks.forEach((w, wi) => {
        out.push(`  Week ${wi + 1}: ${w.title}`);
        w.tasks.forEach((t, ti) => out.push(`    [${checks[`${m.id}-${wi}-${ti}`] ? 'x' : ' '}] ${t}`));
      });
      out.push('');
    });
    flash((await copyText(out.join('\n'))) ? 'Plan copied' : 'Copy was blocked by the browser');
  };

  const copyStatus = async () => {
    if (!rm) return;
    const label = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));
    const out = ['Soullab Studio portfolio status (planning notes only; not authorization)', ''];
    rm.studios.forEach((s) => out.push(`${s}: ${label[status[s] ?? 'unassessed']}`));
    flash((await copyText(out.join('\n'))) ? 'Status copied' : 'Copy was blocked by the browser');
  };

  const current = rm?.plan.find((m) => m.id === month);

  return (
    <main className="min-h-screen bg-[#0d1117] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0d1117]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Back to admin"
              onClick={() => router.push('/admin')}
              className="rounded-lg p-2 text-white/50 transition hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <MapIcon className="h-5 w-5 text-teal-300" />
                <h1 className="text-lg font-semibold tracking-tight">Marketing Roadmap</h1>
              </div>
              <p className="mt-0.5 text-xs text-white/40">December 2026 – November 2027 · proposal for review</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/admin/creative-field')}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              <Palette className="h-3.5 w-3.5" />
              Creative Field
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-12 px-6 py-10">
        {phase === 'loading' && !payload && <p className="text-sm text-white/45">Opening the roadmap…</p>}
        {phase === 'error' && <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}

        {payload && rm && (
          <>
            <div className="space-y-4">
              <div className="font-mono text-xs tracking-[0.5em] text-teal-300">S O U L L A B</div>
              <h2 className="text-3xl font-semibold tracking-tight">{rm.title}</h2>
              <p className="max-w-3xl text-white/65">{rm.strategy}</p>
              <p className="text-sm text-white/50">{rm.owner} · {rm.period} · <i>{rm.tagline}</i></p>
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                <div className="mb-1 font-semibold text-amber-300">Proposal for review, not ratified</div>
                {payload.standing.notice}
              </div>
            </div>

            <Section num="§1" title="The twelve-month roadmap" note="Proposed planning windows. Campaign activation depends on verified product readiness, approved offerings and release authorization.">
              <Table head={['Phase', 'Period', 'Strategic objective']} rows={rm.phases.map((p) => [`${p.id} · ${p.name}`, p.period, p.objective])} />
            </Section>

            <Section num="§2" title="Six parallel workstreams">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rm.workstreams.map((w) => (
                  <div key={w.n} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <span className="font-mono text-xs text-teal-300">{w.n}</span>
                    <h3 className="font-semibold">{w.name}</h3>
                    <p className="text-sm text-white/55">{w.scope}</p>
                    <span className="mt-auto font-mono text-xs text-amber-300/80">{w.owners}</span>
                  </div>
                ))}
              </div>
            </Section>

            <PhaseBand label="Phase I · December 2026 – February 2027" title="Establish the foundation" />

            <Section num="§3" title="Heather's 90-day working plan">
              <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div role="tablist" aria-label="Month" className="flex gap-1 rounded-lg bg-white/5 p-1">
                    {rm.plan.map((m) => (
                      <button
                        key={m.id}
                        role="tab"
                        aria-selected={month === m.id}
                        onClick={() => setMonth(m.id)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium ${month === m.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs text-white/55 tabular-nums">
                    {doneTasks} / {totalTasks} tasks
                    <div className="h-1.5 w-32 overflow-hidden rounded bg-white/10">
                      <div className="h-full bg-teal-400 transition-all" style={{ width: `${totalTasks ? (doneTasks / totalTasks) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
                {current && (
                  <>
                    <div>
                      <h3 className="font-semibold">{current.title}</h3>
                      {current.note && <p className="text-sm text-amber-300/80">{current.note}</p>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {current.weeks.map((w, wi) => (
                        <div key={w.title} className="space-y-2 rounded-lg border border-white/10 p-3">
                          <div className="font-mono text-[11px] uppercase tracking-wider text-white/40">Week {wi + 1}</div>
                          <h4 className="text-sm font-semibold">{w.title}</h4>
                          {w.tasks.map((t, ti) => {
                            const id = `${current.id}-${wi}-${ti}`;
                            return (
                              <label key={id} htmlFor={id} className="flex cursor-pointer items-start gap-2 text-sm leading-snug">
                                <input
                                  id={id}
                                  type="checkbox"
                                  checked={!!checks[id]}
                                  onChange={(e) => toggle(id, e.target.checked)}
                                  className="mt-0.5 accent-teal-400"
                                />
                                <span className={checks[id] ? 'text-white/40 line-through' : 'text-white/80'}>{t}</span>
                              </label>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => void copyPlan()} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white">
                    <ClipboardCopy className="h-3.5 w-3.5" /> Copy complete 90-day plan
                  </button>
                  <button type="button" onClick={() => { setChecks({}); saveJson(CHECKS_KEY, {}); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:bg-white/5 hover:text-white">
                    Clear my checkmarks
                  </button>
                  <span aria-live="polite" className="text-xs text-emerald-300">{toast}</span>
                </div>
              </div>
            </Section>

            <Section num="§4" title="December's essential deliverables">
              <Table head={['Deliverable', 'Purpose', 'Proposed owner']} rows={rm.decemberDeliverables} />
            </Section>

            <PhaseBand label="Phase II · March – May 2027" title="Activate the Doorways" />

            <Section num="§5" title="Studio launch waves" note={rm.wavesNote}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {rm.waves.map((w) => (
                  <div key={w.n} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="font-mono text-xs text-amber-300/80">Wave {w.n} · {w.when}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {w.studios.map((s) => <span key={s} className="rounded-full bg-teal-400/15 px-2.5 py-0.5 text-xs font-medium text-teal-200">{s}</span>)}
                    </div>
                    <p className="text-sm text-white/55">{w.aim}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section num="§5a" title="Story candidates" note={rm.storiesNote}>
              <div className="grid gap-3 md:grid-cols-2">
                {rm.stories.map((st) => (
                  <div key={st.name} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${st.layer === 'Live' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>{st.layer}{st.layer === 'Live' ? '' : ' · not for public promotion'}</span>
                      <span className="font-mono text-xs text-white/40">Wave {st.wave} · {st.studio}</span>
                    </div>
                    <h3 className="font-semibold">{st.name}</h3>
                    <p className="text-sm text-white/75">{st.story}</p>
                    <p className="text-xs text-white/55"><span className="text-white/40">Center of gravity:</span> {st.centerOfGravity}</p>
                    <p className="text-xs text-white/55"><span className="text-white/40">Standing:</span> {st.standing}</p>
                    <p className="border-l-2 border-teal-400 pl-3 text-xs text-white/70">{st.gate}</p>
                    <p className="font-mono text-[11px] text-white/35">{st.source}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section num="§6" title="The repeatable Studio launch cycle">
              <div className="grid overflow-hidden rounded-xl border border-white/10 md:grid-cols-7">
                {rm.launchCycle.map(([t, name, desc]) => (
                  <div key={t} className={`space-y-1 border-b border-white/10 p-3 md:border-b-0 md:border-r ${t === 'Launch' ? 'bg-teal-400/10' : ''}`}>
                    <div className={`font-mono text-xs ${t === 'Launch' ? 'text-teal-300' : 'text-white/40'}`}>{t}</div>
                    <div className="text-sm font-semibold">{name}</div>
                    <p className="text-xs text-white/50">{desc}</p>
                  </div>
                ))}
              </div>
              <p className="border-l-2 border-teal-400 pl-3 text-sm text-white/75">{rm.launchGate}</p>
            </Section>

            <Section num="§7" title="À la carte commerce and membership pathways" note="People should be able to move between offerings without creating new accounts or abandoning the relationships and work they have established.">
              <ul className="flex flex-wrap gap-2">
                {rm.commerceRequirements.map((r) => <li key={r} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/75">{r}</li>)}
              </ul>
            </Section>

            <PhaseBand label="Phase III · June – August 2027" title="Expand participation" />

            <Section num="§8" title="From individual offerings to interconnected experiences" note={rm.bundlesNote}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {rm.bundles.map((b) => (
                  <div key={b.name} className="space-y-1 rounded-xl border border-dashed border-white/15 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-wider text-amber-300/80">{b.kind}</div>
                    <h3 className="font-semibold">{b.name}</h3>
                    <p className="text-sm text-white/55">{b.parts}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section num="§9" title="Partnership development" note="A community of contributors whose work has a natural place within Soullab, rather than an affiliate network.">
              <Table head={['Community', 'Potential opportunity']} rows={rm.partnerships} />
            </Section>

            <PhaseBand label="Phase IV · September – November 2027" title="Mature the ecosystem" />
            <Table head={['Strategic initiative', 'Intended result']} rows={rm.ecosystem} />

            <Section num="§10" title="Development and marketing alignment">
              <p className="max-w-3xl text-sm text-white/70">{rm.alignment}</p>
            </Section>

            <Section num="§11" title="Technical development dependencies" note={rm.dependenciesNote}>
              <Table
                head={['Capability', 'Priority', 'Marketing benefit']}
                rows={rm.dependencies.map(([cap, p, benefit]) => [
                  cap,
                  <span key={p} className={`rounded-full px-2 py-0.5 font-mono text-xs ${p === 'P0' ? 'bg-rose-400/15 text-rose-200' : p === 'P1' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-white/60'}`}>{p}</span>,
                  benefit,
                ])}
              />
            </Section>

            <Section num="§12" title="Marketing Command Center" note="Planning prototype. Every Studio starts unassessed. Statuses are planning notes kept in this browser; they do not authorize or activate campaigns.">
              <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ['Studio portfolios', rm.studios.length],
                    ['Campaigns marked active', counts.active ?? 0],
                    ['Preparing', counts.preparing ?? 0],
                    ['Unassessed', counts.unassessed ?? 0],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-lg bg-white/5 p-3">
                      <div className="text-2xl font-semibold tabular-nums">{v}</div>
                      <div className="text-xs text-white/50">{k}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {rm.studios.map((s, i) => {
                    const v = status[s] ?? 'unassessed';
                    const opt = STATUS_OPTIONS.find((o) => o.value === v) ?? STATUS_OPTIONS[0];
                    return (
                      <div key={s} className="space-y-2">
                        <div className={`flex h-20 items-end justify-center rounded-t-full border border-b-0 pb-3 text-center text-sm font-medium ${opt.cls}`}>{s}</div>
                        <select
                          id={`studio-status-${i}`}
                          aria-label={`${s} status`}
                          value={v}
                          onChange={(e) => setStudio(s, e.target.value)}
                          className="w-full rounded-md border border-white/10 bg-[#0d1117] px-2 py-1.5 text-xs text-white"
                        >
                          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={() => void copyStatus()} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white">
                  <ClipboardCopy className="h-3.5 w-3.5" /> Export portfolio status
                </button>
              </div>
            </Section>

            <Section num="§13" title="How we evaluate the first year" note={rm.evaluationNote}>
              <Table head={['Dimension', 'Success indicator']} rows={rm.evaluation} />
            </Section>

            <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
              <div className="font-mono text-xs uppercase tracking-widest text-white/40">§14 · Our North Star</div>
              <h2 className="text-3xl font-semibold tracking-tight">{rm.northStar.headline}</h2>
              <p className="text-white/60">{rm.northStar.subline}</p>
              {rm.northStar.lines.map((l) => <p key={l} className="mx-auto max-w-2xl text-sm text-white/65">{l}</p>)}
              <p className="mx-auto max-w-2xl font-medium text-teal-300">{rm.northStar.bridge}</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
