'use client';

/**
 * PatternOfferCard — the member's verdict on a pattern MAIA offered.
 *
 * Canon: SPIRAL_CONTINUITY_ENGINE §6a.3–6a.4 (ratified 2026-11-23). The card names
 * every kept item the pattern rests on, in the member's own words and with when they
 * kept it, and gives the member the decision: keep it, put it in their own words, or
 * let it go. Ignoring the card is also an answer: nothing is stored.
 */

import { useState } from 'react';
import { apiFetch } from '@/lib/http/apiBase';
import type { PatternOffer } from '@/lib/maia/patternRecognition';

type Phase = 'open' | 'editing' | 'saving' | 'kept' | 'corrected' | 'dismissed' | 'error';

function when(at: string | null): string {
  if (!at) return '';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PatternOfferCard({ offer }: { offer: PatternOffer }) {
  const [phase, setPhase] = useState<Phase>('open');
  const [ownWords, setOwnWords] = useState(offer.wording);
  const [error, setError] = useState<string | null>(null);

  async function send(action: 'confirm' | 'correct' | 'dismiss') {
    setPhase('saving');
    setError(null);
    try {
      const res = await apiFetch('/api/psyche/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          offer: {
            wording: offer.wording,
            sources: offer.sources.map((s) => ({ kind: s.kind, id: s.id })),
            offeredAt: offer.offeredAt,
            originSurface: offer.originSurface,
          },
          ...(action === 'correct' ? { correctedWording: ownWords } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setPhase(action === 'confirm' ? 'kept' : action === 'correct' ? 'corrected' : 'dismissed');
    } catch (e) {
      setError((e as Error).message || 'Something went wrong');
      setPhase('error');
    }
  }

  if (phase === 'kept' || phase === 'corrected') {
    return (
      <p className="mt-3 text-xs text-dune-amber/80" style={{ fontFamily: 'Spectral, Georgia, serif' }}>
        Kept{phase === 'corrected' ? ' in your words' : ''}. You can change or remove it any time in Keep &amp; Capture.
      </p>
    );
  }
  if (phase === 'dismissed') {
    return (
      <p className="mt-3 text-xs text-stone-400" style={{ fontFamily: 'Spectral, Georgia, serif' }}>
        Let go. MAIA won&apos;t offer this one again.
      </p>
    );
  }

  return (
    <div
      className="mt-4 rounded-xl border border-dune-amber/25 bg-dune-sand/10 p-3 text-sm"
      style={{ fontFamily: 'Spectral, Georgia, serif' }}
      data-testid="pattern-offer-card"
    >
      <p className="text-xs uppercase tracking-widest text-dune-amber/70">A pattern MAIA offered — yours to decide</p>
      <ul className="mt-2 space-y-1 text-xs text-stone-300">
        {offer.sources.map((s) => (
          <li key={`${s.kind}:${s.id}`}>
            {s.kind === 'pattern' ? 'Your pattern: ' : ''}&ldquo;{s.label}&rdquo;
            {s.at ? <span className="text-stone-500"> — {s.kind === 'pattern' ? 'confirmed' : 'kept'} {when(s.at)}</span> : null}
          </li>
        ))}
      </ul>

      {phase === 'editing' ? (
        <div className="mt-3">
          <label className="sr-only" htmlFor="pattern-own-words">In your own words</label>
          <textarea
            id="pattern-own-words"
            value={ownWords}
            onChange={(e) => setOwnWords(e.target.value)}
            maxLength={1000}
            rows={3}
            className="w-full rounded-lg border border-dune-amber/30 bg-transparent p-2 text-sm text-stone-200"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => send('correct')}
              disabled={!ownWords.trim()}
              className="px-3 py-1.5 text-xs rounded-full bg-dune-sand/20 text-dune-amber border border-dune-amber/30 hover:bg-dune-sand/30 disabled:opacity-40"
            >
              Keep in my words
            </button>
            <button
              onClick={() => setPhase('open')}
              className="px-3 py-1.5 text-xs rounded-full text-stone-400 hover:text-stone-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => send('confirm')}
            disabled={phase === 'saving'}
            className="px-3 py-1.5 text-xs rounded-full text-dune-amber/90 border border-dune-amber/25 hover:bg-dune-sand/20"
          >
            Keep it
          </button>
          <button
            onClick={() => setPhase('editing')}
            disabled={phase === 'saving'}
            className="px-3 py-1.5 text-xs rounded-full text-dune-amber/90 border border-dune-amber/25 hover:bg-dune-sand/20"
          >
            In my words
          </button>
          <button
            onClick={() => send('dismiss')}
            disabled={phase === 'saving'}
            className="px-3 py-1.5 text-xs rounded-full text-dune-amber/90 border border-dune-amber/25 hover:bg-dune-sand/20"
          >
            Not this
          </button>
        </div>
      )}
      {phase === 'error' && error ? <p className="mt-2 text-xs text-red-300">Couldn&apos;t save: {error}</p> : null}
    </div>
  );
}

export default PatternOfferCard;
