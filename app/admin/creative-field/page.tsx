'use client';

/**
 * Admin: Creative Field, stage 1 (read-only). Owner record: Soullab/Sovereign#2417.
 *
 * Lists the creative tools available to the internal team, with each tool's
 * license and the obligations that travel with its output. The data comes from
 * the admin-guarded API route; this file imports types only. Nothing here
 * generates, queues or spends.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Map as MapIcon, Palette, RefreshCw } from 'lucide-react';
import { adminFetch } from '@/lib/admin/adminFetch';
import type { CreativeFieldPayload, CreativeTool } from '@/lib/creative/toolRegistry';

const KIND_LABEL: Record<CreativeTool['kind'], string> = { image: 'Image', video: 'Video', assembly: 'Assembly' };

const COMMERCIAL_LABEL: Record<CreativeTool['license']['commercialUse'], { text: string; cls: string }> = {
  yes: { text: 'Commercial use allowed', cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' },
  conditional: { text: 'Commercial use with conditions', cls: 'border-amber-400/30 bg-amber-400/10 text-amber-100' },
  'per-provider': { text: 'Depends on provider model', cls: 'border-white/15 bg-white/[0.04] text-white/70' },
};

function StatusPill({ tool }: { tool: CreativeTool }) {
  const ready = tool.status === 'verified-locally';
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs ${
        ready ? 'border-teal-400/30 bg-teal-400/10 text-teal-200' : 'border-white/15 bg-white/[0.04] text-white/55'
      }`}
    >
      {ready ? 'Verified locally' : 'Disabled'}
    </span>
  );
}

function ToolCard({ tool, obligationText }: { tool: CreativeTool; obligationText: CreativeFieldPayload['obligationText'] }) {
  const commercial = COMMERCIAL_LABEL[tool.license.commercialUse];
  return (
    <article className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
            {KIND_LABEL[tool.kind]} · {tool.engine === 'local' ? 'Local' : 'Paid service'} · {tool.costClass === 'free' ? 'No cost' : 'Paid'}
          </div>
          <h3 className="mt-1 text-lg font-semibold">{tool.label}</h3>
          <p className="text-sm text-white/60">{tool.model}</p>
        </div>
        <StatusPill tool={tool} />
      </header>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-white/40">Runs with</dt>
          <dd className="text-white/75">{tool.runtime}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/40">License</dt>
          <dd className="space-y-1">
            <a href={tool.license.url} target="_blank" rel="noopener noreferrer" className="text-teal-300 underline-offset-2 hover:underline">
              {tool.license.name}
            </a>
            <div>
              <span className={`inline-block rounded-md border px-2 py-0.5 text-xs ${commercial.cls}`}>{commercial.text}</span>
            </div>
          </dd>
        </div>
      </dl>

      {tool.obligations.length > 0 && (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3">
          <div className="mb-1 text-xs font-semibold text-amber-300">What its output carries</div>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-50/85">
            {tool.obligations.map((o) => (
              <li key={o}>{obligationText[o]}</li>
            ))}
          </ul>
        </div>
      )}

      {tool.measured.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-white/40">Measured on the Mac Studio</div>
          <ul className="space-y-0.5 font-mono text-xs text-white/60 tabular-nums">
            {tool.measured.map((m) => (
              <li key={`${m.date}-${m.setting}`}>
                {m.date} · {m.setting} → {m.result}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-white/55">{tool.notes}</p>
    </article>
  );
}

export default function CreativeFieldAdminPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<CreativeFieldPayload | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const res = await adminFetch('/api/admin/creative-field', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) {
        setError('This page is for founder, CTO and operations admins. Sign in with one of those roles to open the Creative Field.');
        setPhase('error');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setPayload((await res.json()) as CreativeFieldPayload);
      setPhase('ready');
    } catch {
      setError('The Creative Field could not be loaded just now. Try Refresh.');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
                <Palette className="h-5 w-5 text-teal-300" />
                <h1 className="text-lg font-semibold tracking-tight">Creative Field</h1>
              </div>
              <p className="mt-0.5 text-xs text-white/40">Internal team · stage 1 · read-only</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/admin/marketing-roadmap')}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              <MapIcon className="h-3.5 w-3.5" />
              Marketing Roadmap
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

      <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        {phase === 'loading' && !payload && <p className="text-sm text-white/45">Opening the Creative Field…</p>}
        {phase === 'error' && <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}

        {payload && (
          <>
            <div className="space-y-4">
              <h2 className="text-3xl font-semibold tracking-tight">The tools in one place</h2>
              <p className="max-w-3xl text-white/65">
                Image, video and assembly tools from the local creative stack, with what each license allows and what its output must carry.
              </p>
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                <div className="mb-1 font-semibold text-amber-300">Read-only: nothing here generates or spends</div>
                {payload.standing.notice}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span
                  className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-white/65"
                  aria-label="Generation worker status"
                >
                  Worker: not connected
                </span>
                <span className="text-white/45">{payload.standing.worker.note}</span>
              </div>
            </div>

            <section className="grid gap-5 lg:grid-cols-2" aria-label="Creative tools">
              {payload.tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} obligationText={payload.obligationText} />
              ))}
            </section>

            <p className="text-xs text-white/35">Owner record: {payload.standing.ownerIssue}</p>
          </>
        )}
      </div>
    </main>
  );
}
