'use client';
/**
 * "Share with Soullab" under one of MAIA's stored answers (Studio Academy slice 6; founder rulings 2026-11-19). BUILT DARK:
 * drawn only when the server flag is on (useShareExchangeEnabled), and the route refuses on its own when it is off.
 *
 * ⛔ Nothing is sent until the writer has seen exactly what will be shared and clicked "Share this exchange".
 * ⛔ Never drawn for a Sanctuary exchange: those are not stored turns and never reach this component.
 */
import { useState } from 'react';
import { INK, MAIA_ACCENT, RADIUS, RULE, SPACE, GROUND } from '../studioTheme';
import { StudioText } from '../studio/StudioType';
import {
  SHARE_CONFIRM_LABEL, SHARE_EXPLAINER, SHARE_LABEL, SHARE_WITHDRAW_LABEL, SHARED_MARK, shareRefusalCopy,
} from '@/lib/writersStudio/sharedExchanges';
import { shareMyExchange, withdrawMyShare } from '@/lib/writersStudio/sharedExchangesClient';
import type { OwnShare } from '@/lib/writersStudio/sharedExchangesServer';

export default function ShareExchangeOffer(props: {
  workId: string; threadId: string; maiaTurnIndex: number;
  question: string | null; answer: string;
  shared: OwnShare | undefined;
  onShared: (share: OwnShare) => void;
  onWithdrawn: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const quiet = { background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: INK.quiet } as const;

  if (props.shared) {
    return (
      <div data-shared-exchange={props.maiaTurnIndex} style={{ marginTop: SPACE.hairline, display: 'flex', gap: SPACE.tight, alignItems: 'baseline' }}>
        <StudioText role="metadata" tone="quiet" as="span">{SHARED_MARK}</StudioText>
        <button type="button" disabled={busy} style={quiet} onClick={async () => {
          setBusy(true);
          const ok = await withdrawMyShare(props.shared!.id);
          setBusy(false);
          if (ok) { props.onWithdrawn(props.shared!.id); setStatus('Withdrawn. It has been deleted.'); }
          else setStatus('That wasn’t withdrawn. Try again.');
        }}>
          <StudioText role="metadata" as="span">{busy ? 'Withdrawing…' : SHARE_WITHDRAW_LABEL}</StudioText>
        </button>
        {status ? <StudioText role="metadata" tone="secondary" as="span" aria-live="polite">{status}</StudioText> : null}
      </div>
    );
  }

  if (!open) {
    return (
      <div style={{ marginTop: SPACE.hairline }}>
        <button type="button" style={quiet} onClick={() => { setOpen(true); setStatus(null); }}>
          <StudioText role="metadata" as="span">{SHARE_LABEL}</StudioText>
        </button>
        {status ? <StudioText role="metadata" tone="secondary" aria-live="polite">{status}</StudioText> : null}
      </div>
    );
  }

  return (
    <div data-share-preview={props.maiaTurnIndex} style={{ marginTop: SPACE.tight, border: `1px solid ${RULE.soft}`, borderRadius: RADIUS.sm, padding: SPACE.snug, background: GROUND.base }}>
      <StudioText role="metadata" tone="secondary" style={{ marginBottom: SPACE.tight }}>This is exactly what Soullab would see:</StudioText>
      {props.question ? (
        <StudioText role="metadata" style={{ color: INK.secondary, whiteSpace: 'pre-wrap', marginBottom: SPACE.tight }}>You asked: {props.question}</StudioText>
      ) : null}
      <StudioText role="metadata" style={{ color: MAIA_ACCENT.reading, whiteSpace: 'pre-wrap', marginBottom: SPACE.tight, maxHeight: 180, overflow: 'auto' }}>MAIA answered: {props.answer}</StudioText>
      <ul style={{ margin: `0 0 ${SPACE.tight}px`, paddingLeft: 18, color: INK.secondary }}>
        {SHARE_EXPLAINER.map((line) => <li key={line}><StudioText role="metadata" as="span">{line}</StudioText></li>)}
      </ul>
      <div style={{ display: 'flex', gap: SPACE.tight }}>
        <button type="button" disabled={busy} onClick={async () => {
          setBusy(true);
          const r = await shareMyExchange({ workId: props.workId, threadId: props.threadId, maiaTurnIndex: props.maiaTurnIndex });
          setBusy(false);
          if (r.ok) { setOpen(false); props.onShared(r.share); }
          else { setOpen(false); setStatus(shareRefusalCopy(r.refusal)); }
        }} style={{ background: MAIA_ACCENT.voice, border: `1px solid ${MAIA_ACCENT.voice}`, borderRadius: RADIUS.sm, padding: `${SPACE.tight}px ${SPACE.snug}px`, cursor: 'pointer', color: INK.primary, opacity: busy ? 0.45 : 1 }}>
          <StudioText role="metadata" as="span">{busy ? 'Sharing…' : SHARE_CONFIRM_LABEL}</StudioText>
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: INK.muted }}>
          <StudioText role="metadata" as="span">Not now</StudioText>
        </button>
      </div>
    </div>
  );
}
