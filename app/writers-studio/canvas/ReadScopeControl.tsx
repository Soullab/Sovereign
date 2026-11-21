'use client';
/**
 * WS-WORK-CONTINUITY · B — where the writer decides, once and revocably, whether MAIA may read the saved text of this Work in
 * conversation. Nothing is pre-selected and nothing is inferred; the unset state is "MAIA reads only the passage you are in".
 * It never promises a read the server will withhold: an unreadable or ON Sanctuary setting, a failed check and a failed change are all said.
 */
import { useCallback, useEffect, useState } from 'react';
import SessionPostureChoice from '@/app/writers-studio/canvas/SessionPostureChoice';
import { getReadScope, setReadScope, type ReadScope } from '@/lib/writersStudio/readScopeClient';
import { readCurrentSanctuaryPosture } from '@/lib/sanctuary/currentClientPosture';

/** Said after Stop in compact mode, where the unset choice is not shown, so the writer sees that Stop took effect. */
export const READ_SCOPE_STOPPED_COPY = 'Stopped. MAIA now reads only the passage you are in.';

/**
 * `compact` (D3, R3.4.4 founder ruling A, 2026-11-19): for surfaces that hide the holdings (e.g. the Develop stage). It shows
 * nothing until a permission is ACTIVE, and then always shows it with its one-action Stop: an active permission is never out of
 * sight. Giving a permission stays where the full control is (More → What MAIA can read); compact never offers it.
 */
/**
 * `status` (founder ruling 2026-11-19, "WS B0 + D3 laptop experience"): the default in a conversation. One persistent line says
 * whether saved-Work reading is allowed, with Change, and with Stop directly visible whenever a permission is active (never behind
 * More or an expansion). The choice itself is NOT shown before the writer has said anything (no premature gate): it opens under
 * Change, or when the writer turns to a question that a reading permission could serve (`offerNow`). It states permission only;
 * what MAIA actually read for an answer stays D3's per-answer line.
 */
export const READ_SCOPE_STATUS_LABEL = 'Saved Work reading:';
export const READ_SCOPE_OFFER_COPY = 'Talking about the whole book? You can let MAIA read your saved work for it. Nothing is read until you ask a question.';

export default function ReadScopeControl({ manuscriptId, compact = false, status = false, offerNow = false }: {
  manuscriptId: string; compact?: boolean; status?: boolean; offerNow?: boolean;
}) {
  const [, setPostureTick] = useState(0); // re-read the posture after the writer chooses it
  const [scope, setScope] = useState<ReadScope | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [offerDeclined, setOfferDeclined] = useState(false);
  const load = useCallback(() => { void getReadScope(manuscriptId).then((s) => { setScope(s); setChecked(true); }); }, [manuscriptId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const f = () => load(); window.addEventListener('focus', f); return () => window.removeEventListener('focus', f); }, [load]);

  const btn = { background: 'transparent', border: '1px solid currentColor', borderRadius: 6,
    padding: '2px 8px', font: 'inherit', cursor: 'pointer', opacity: busy ? 0.5 : 1 } as const;

  if (!checked) return null;
  /* Compact: no permission (or one that could not be checked) shows nothing here; a just-taken Stop is confirmed. */
  if (compact && !scope) {
    return note ? <div data-read-scope-control="compact" role="status" style={{ fontSize: 12 }}>{note}</div> : null;
  }
  if (scope === undefined) {
    return (
      <div data-read-scope-control="true" role="status" style={{ fontSize: 12 }}>
        <span>Your reading setting could not be checked just now. </span>
        <button type="button" style={btn} onClick={load}>Try again</button>
      </div>
    );
  }

  const change = async (c: Parameters<typeof setReadScope>[1]) => {
    setBusy(true); setNote(null);
    const next = await setReadScope(manuscriptId, c);
    if (next && typeof next === 'object' && 'refused' in next) {
      setNote(next.refused === 'sanctuary_not_kept'
        ? 'Sanctuary is on, and MAIA doesn’t use this permission in Sanctuary, so it wasn’t recorded. Turn Sanctuary off to give it.'
        : 'Nothing was changed yet: choose how MAIA holds this session below, then choose again.');
    } else if (next !== undefined) { setScope(next); if (compact && next === null) setNote(READ_SCOPE_STOPPED_COPY); } else setNote('That could not be changed just now. Nothing was changed; your setting is as it was.');
    setBusy(false);
  };

  const posture = typeof window !== 'undefined' ? readCurrentSanctuaryPosture() : { resolved: false as const };
  const postureNote = !posture.resolved
    ? 'For now MAIA is reading only the passage you are in, because she doesn’t yet know how to hold this session.'
    : posture.sanctuary ? 'Sanctuary is on, so MAIA is reading only the passage you are in. Your setting is kept for when Sanctuary is off.' : null;

  if (status) {
    /* scope: null = no permission; { level } = active. (undefined was handled above: "could not be checked" + Try again.) */
    const level = scope ? scope.level : null;
    const active = level !== null;
    const state = level === null ? 'Off' : level === 'work' ? 'Allowed' : 'This passage’s saved version';
    const offering = !active && offerNow && !offerDeclined;
    const chooserOpen = changing || offering;
    return (
      <div data-read-scope-control="status" data-read-scope-state={level ?? 'off'}
        style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{READ_SCOPE_STATUS_LABEL} <strong data-read-scope-status="true">{state}</strong></span>
          <button type="button" disabled={busy} style={btn} aria-expanded={chooserOpen} data-read-scope-change="true"
            onClick={() => { setChanging((v) => !v); setOfferDeclined(true); }}>Change</button>
          {active ? (
            /* ⭐ An active permission always carries its one-action Stop in plain sight. */
            <button type="button" disabled={busy} style={btn} data-read-scope-stop="true"
              onClick={() => { setChanging(false); void change({ action: 'revoke' }); }}>Stop</button>
          ) : null}
        </div>
        {active && postureNote ? <span data-read-scope-posture-note="true" role="status">{postureNote}</span> : null}
        {active && !posture.resolved ? <SessionPostureChoice compact onChosen={() => { setNote(null); setPostureTick((t) => t + 1); }} /> : null}
        {chooserOpen ? (
          <div data-read-scope-chooser={offering ? 'offer' : 'change'} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{offering ? READ_SCOPE_OFFER_COPY : active
              ? (level === 'work' ? 'MAIA may read your saved work when your question needs it.' : 'MAIA may read the saved version of the passage you are in.')
              : 'MAIA reads only the passage you are in.'}</span>
            {level !== 'work' ? (
              <button type="button" disabled={busy} style={btn} onClick={() => { setChanging(false); void change({ action: 'grant', level: 'work' }); }}>
                Let MAIA read my saved work
              </button>
            ) : null}
            {level !== 'chapter' ? (
              <button type="button" disabled={busy} style={btn} onClick={() => { setChanging(false); void change({ action: 'grant', level: 'chapter' }); }}>
                Only the passage I am in
              </button>
            ) : null}
            {offering ? <button type="button" disabled={busy} style={btn} onClick={() => setOfferDeclined(true)}>Not now</button> : null}
          </div>
        ) : null}
        {note ? <span data-read-scope-change-note="true" role="status">{note}</span> : null}
      </div>
    );
  }

  return (
    <div data-read-scope-control="true" style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {scope === null ? (
        <>
          <span>MAIA reads only the passage you are in.</span>
          <button type="button" disabled={busy} style={btn} onClick={() => change({ action: 'grant', level: 'work' })}>
            Let MAIA read my saved work
          </button>
          <button type="button" disabled={busy} style={btn} onClick={() => change({ action: 'grant', level: 'chapter' })}>
            Only the passage I am in
          </button>
        </>
      ) : (
        <>
          <span>{scope.level === 'work'
            ? 'MAIA may read your saved work when your question needs it.'
            : 'MAIA may read the saved version of the passage you are in.'} You can stop this any time.</span>
          <button type="button" disabled={busy} style={btn} onClick={() => change({ action: 'revoke' })}>Stop</button>
          {postureNote ? <span data-read-scope-posture-note="true" role="status">{postureNote}</span> : null}
          {!posture.resolved ? <SessionPostureChoice compact onChosen={() => { setNote(null); setPostureTick((t) => t + 1); }} /> : null}
        </>
      )}
      {note ? <span data-read-scope-change-note="true" role="status">{note}</span> : null}
    </div>
  );
}
