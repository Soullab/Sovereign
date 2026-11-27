'use client';

/**
 * PatternsSection — Keep & Capture's home for the member's patterns and their dial.
 *
 * Canon: SPIRAL_CONTINUITY_ENGINE §6a.4 (a kept pattern is the member's: visible,
 * editable, resealable, deletable) and §6a.7 (the dial: Full by default; Gentle,
 * When I ask, Off). Dialling back deletes nothing.
 */

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/http/apiBase';
import type { ConfirmedPattern, PatternLevel } from '@/lib/maia/patternRecognition';

const LEVELS: Array<{ level: PatternLevel; label: string; hint: string }> = [
  { level: 'full', label: 'Full', hint: 'MAIA offers patterns she sees across what you keep, including patterns across your patterns.' },
  { level: 'gentle', label: 'Gentle', hint: 'At most one offer in a conversation, from kept items only.' },
  { level: 'on_request', label: 'When I ask', hint: 'Only when you ask her to look for patterns.' },
  { level: 'off', label: 'Off', hint: 'No pattern offers. Your kept items and patterns stay.' },
];

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await apiFetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (!r.ok) throw new Error(`${init?.method ?? 'GET'} ${url} failed: ${r.status}`);
  return r.json();
}

function when(at: string | Date | null): string {
  if (!at) return '';
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PatternsSection() {
  const [patterns, setPatterns] = useState<ConfirmedPattern[]>([]);
  const [level, setLevel] = useState<PatternLevel>('full');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const reload = useCallback(async () => {
    try {
      const r = await call<{ patterns: ConfirmedPattern[]; level: PatternLevel }>('/api/psyche/patterns');
      setPatterns(r.patterns);
      setLevel(r.level);
      setError(null);
    } catch {
      setError('Could not load your patterns right now.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function chooseLevel(next: PatternLevel) {
    const prev = level;
    setLevel(next);
    try {
      await call('/api/psyche/patterns/level', { method: 'PUT', body: JSON.stringify({ level: next }) });
    } catch {
      setLevel(prev);
      setError('Could not change the setting.');
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    try {
      await call(`/api/psyche/patterns/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await reload();
    } catch {
      setError('Could not save that change.');
    }
  }

  async function remove(id: string) {
    try {
      await call(`/api/psyche/patterns/${id}`, { method: 'DELETE' });
      await reload();
    } catch {
      setError('Could not remove it.');
    }
  }

  if (!loaded) return null;
  const active = patterns.filter((p) => p.status !== 'archived');
  const archived = patterns.filter((p) => p.status === 'archived');

  return (
    <section className="mb-12" data-testid="patterns-section">
      <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-4">Patterns</h2>

      <fieldset className="mb-6">
        <legend className="text-sm text-stone-600 mb-2">How much should MAIA look for patterns across what you keep?</legend>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.level}
              type="button"
              aria-pressed={level === l.level}
              onClick={() => chooseLevel(l.level)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                level === l.level
                  ? 'bg-stone-800 text-stone-50 border-stone-800'
                  : 'text-stone-600 border-stone-300 hover:border-stone-500'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-500 mt-2">{LEVELS.find((l) => l.level === level)?.hint}</p>
      </fieldset>

      {error && <p className="text-sm text-stone-500 mb-3">{error}</p>}

      {active.length === 0 && archived.length === 0 ? (
        <p className="text-sm text-stone-500">
          When MAIA offers a pattern and you keep it, it lives here, with what it rests on.
        </p>
      ) : (
        <ul className="space-y-3">
          {[...active, ...archived].map((p) => (
            <li key={p.id} className={`rounded-lg border border-stone-200 bg-white p-4 ${p.status === 'archived' ? 'opacity-60' : ''}`}>
              {editing === p.id ? (
                <div>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    className="w-full rounded border border-stone-300 p-2 text-sm text-stone-800"
                  />
                  <div className="mt-2 flex gap-3 text-xs">
                    <button
                      className="text-stone-700 hover:text-stone-900"
                      disabled={!draft.trim()}
                      onClick={async () => {
                        await patch(p.id, { wording: draft });
                        setEditing(null);
                      }}
                    >
                      Save in my words
                    </button>
                    <button className="text-stone-400 hover:text-stone-600" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-stone-800">{p.wording}</p>
              )}
              <p className="text-xs text-stone-400 mt-1">
                {p.wordedBy === 'member' ? 'In your words' : "MAIA's words, kept by you"} · {when(p.confirmedAt)}
                {p.status === 'archived' ? ' · set aside' : ''}
                {p.returnPreference === 'member_pulled' ? ' · returns only when you ask' : ''}
              </p>
              <ul className="mt-2 text-xs text-stone-500 space-y-0.5">
                {p.sources.map((s) => (
                  <li key={`${s.kind}:${s.id}`}>
                    rests on {s.kind === 'pattern' ? 'your pattern ' : ''}&ldquo;{s.label}&rdquo;{s.at ? ` (${when(s.at)})` : ''}
                  </li>
                ))}
              </ul>
              {editing !== p.id && (
                <div className="mt-3 flex flex-wrap gap-4 text-xs">
                  <button
                    className="text-stone-500 hover:text-stone-800"
                    onClick={() => {
                      setDraft(p.wording);
                      setEditing(p.id);
                    }}
                  >
                    Put it in my words
                  </button>
                  {p.status === 'archived' ? (
                    <button className="text-stone-500 hover:text-stone-800" onClick={() => patch(p.id, { status: 'active' })}>
                      Bring back
                    </button>
                  ) : (
                    <button className="text-stone-500 hover:text-stone-800" onClick={() => patch(p.id, { status: 'archived' })}>
                      Set aside
                    </button>
                  )}
                  <button
                    className="text-stone-500 hover:text-stone-800"
                    onClick={() =>
                      patch(p.id, {
                        returnPreference: p.returnPreference === 'member_pulled' ? 'contextual_doorway' : 'member_pulled',
                      })
                    }
                  >
                    {p.returnPreference === 'member_pulled' ? 'Let MAIA bring it up' : 'Only when I ask'}
                  </button>
                  <button className="text-stone-500 hover:text-red-700" onClick={() => remove(p.id)}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default PatternsSection;
