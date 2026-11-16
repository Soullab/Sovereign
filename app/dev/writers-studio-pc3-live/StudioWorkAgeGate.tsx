'use client';

/**
 * The age question at the Work (founder ruling 2026-11-16, #1900):
 *   "if minors are using they must check off that they are under adult supervision." · "Yes, block under 13".
 *
 * #2309 asked at the program's door. A production walk the same day found an existing College Essay Work opening straight
 * into the Studio, with MAIA reading it and no attestation on record. This asks the same question, in the door's own words,
 * before any room of a Work whose RECORDED program requires it (the server decides `required` from the database).
 * The server enforces the same on every MAIA route (lib/studios/workAgeGate.ts); this is the member's way to say it.
 *
 * ⛔ Under 13: turned away, nothing is sent or kept. ⛔ Anything unreadable: nothing opens, nothing is saved, try again.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/http/apiBase';

type AgeState = 'checking' | 'ask' | 'teen' | 'under13' | 'ok' | 'error';

export default function StudioWorkAgeGate({ workId, children }: { workId: string | null; children: ReactNode }) {
  const [age, setAge] = useState<AgeState>(workId ? 'checking' : 'ok');
  const [supervised, setSupervised] = useState(false);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async (live: () => boolean) => {
    if (!workId) { setAge('ok'); return; }
    setAge('checking');
    try {
      const r = await apiFetch(`/api/sovereign/writers-studio/age-attestation?work=${encodeURIComponent(workId)}`, { method: 'GET' });
      const b = await r.json().catch(() => null) as { attested?: unknown; required?: unknown } | null;
      if (!live()) return;
      if (!r.ok || typeof b?.required !== 'boolean') { setAge('error'); return; }
      setAge(!b.required || b.attested === 'adult' || b.attested === 'minor' ? 'ok' : 'ask');
    } catch { if (live()) setAge('error'); }
  }, [workId]);

  useEffect(() => {
    let live = true;
    void check(() => live);
    return () => { live = false; };
  }, [check]);

  const attest = async (band: 'adult' | 'minor') => {
    setBusy(true);
    try {
      const r = await apiFetch('/api/sovereign/writers-studio/age-attestation', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(band === 'adult' ? { band } : { band, supervised: true }),
      });
      setAge(r.ok ? 'ok' : 'error');
    } catch { setAge('error'); } finally { setBusy(false); }
  };

  if (age === 'ok') return <>{children}</>;
  return (
    <main className="wsio-age" data-work-age-gate={age} style={{ maxWidth: 560, margin: '64px auto', padding: '0 16px' }}>
      {age === 'checking' ? <p className="wsio-note" role="status">One moment…</p> : null}
      {age === 'ask' ? (
        <>
          <p className="wsio-maia wsio-small">Before we begin: how old are you?</p>
          <p className="wsio-note">This Studio is for students working on their own college essay.</p>
          <div className="wsio-row">
            <button type="button" className="fr-home-quiet" disabled={busy} onClick={() => void attest('adult')}>I’m 18 or older</button>
            <button type="button" className="fr-home-quiet" disabled={busy} onClick={() => setAge('teen')}>I’m 13 to 17</button>
            <button type="button" className="fr-home-quiet" disabled={busy} onClick={() => setAge('under13')}>I’m under 13</button>
          </div>
        </>
      ) : null}
      {age === 'teen' ? (
        <>
          <p className="wsio-maia wsio-small">You can use this Studio with an adult’s supervision.</p>
          <label className="wsio-check">
            <input type="checkbox" checked={supervised} onChange={(e) => setSupervised(e.target.checked)} data-age-supervised />
            <span>A parent, guardian or teacher is supervising my use of this Studio.</span>
          </label>
          <div className="wsio-row">
            <button type="button" className="fr-home-primary" disabled={!supervised || busy} onClick={() => void attest('minor')}>Continue</button>
            <button type="button" className="wsio-link" onClick={() => { setSupervised(false); setAge('ask'); }}>Back</button>
          </div>
        </>
      ) : null}
      {age === 'under13' ? (
        <>
          <p className="wsio-maia wsio-small">College Essay Studio is for students 13 and older.</p>
          <p className="wsio-note">Nothing about you has been saved. A parent or teacher can help you find other ways to work on your writing.</p>
          <button type="button" className="wsio-link" onClick={() => setAge('ask')}>Back</button>
        </>
      ) : null}
      {age === 'error' ? (
        <>
          <p className="p4r1-error" role="alert">This couldn’t be checked just now. Nothing was saved. Please try again in a moment.</p>
          <button type="button" className="wsio-link" onClick={() => void check(() => true)}>Try again</button>
        </>
      ) : null}
    </main>
  );
}
