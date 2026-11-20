'use client';
/**
 * The founder's read-only list of exchanges writers chose to share (Studio Academy slice 6). Drawn inside the founder view only
 * when the share switch is on; the route also checks the reader is the founder. ⛔ Read-only: nothing here feeds MAIA.
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/http/apiBase';
import { parseStudioActions } from '@/lib/writersStudio/studioActions';
import { useShareExchangeEnabled } from '@/lib/writersStudio/ShareExchangeContext';
import type { FounderShare } from '@/lib/writersStudio/sharedExchangesServer';

export default function FounderSharedExchanges() {
  const enabled = useShareExchangeEnabled();
  const [shares, setShares] = useState<FounderShare[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void apiFetch('/api/sovereign/writers-studio/shared-exchanges?scope=all')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (live) setShares(Array.isArray(body?.shares) ? body.shares : []); })
      .catch(() => { if (live) setShares([]); });
    return () => { live = false; };
  }, [enabled]);
  if (!enabled || shares === null) return null;
  return (
    <section className="p4r1-journey-prompt" data-founder-shared-exchanges>
      <p className="p4r1-journey-question">Conversations writers shared with you</p>
      <small>{shares.length} shared · each is deleted when the writer withdraws it or it expires</small>
      {shares.map((s) => (
        <div key={s.id} className="p4r1-journey-answer">
          <b>{s.memberName} · {new Date(s.createdAt).toLocaleDateString()}</b>
          {s.exchange ? (
            <>
              {s.exchange.question ? <p>They asked: {s.exchange.question}</p> : null}
              <p>MAIA answered: {parseStudioActions(s.exchange.answer, 'work-conversation').text}</p>
            </>
          ) : <p>This share could not be read.</p>}
        </div>
      ))}
    </section>
  );
}
