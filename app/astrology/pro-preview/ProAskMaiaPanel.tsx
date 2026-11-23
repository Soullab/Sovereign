'use client';

/**
 * "Ask MAIA about this" for a section of Pro (founder request 2026-11-07).
 *
 * Before anything is sent the panel says whose charts MAIA will read; only the
 * section's calculated facts reach MAIA, never names or birth details, and
 * nothing is kept. The questions and answers of this visit stay in the page
 * (kept through access checks) and go when the chart closes.
 *
 * Inside the cockpit (a MAIA stage is present) an instrument does not open its
 * own box: it offers its subject to the stage and shows one button that takes
 * the astrologer into the conversation about it. Outside the cockpit the panel
 * opens in place, as before.
 *
 * The conversation (founder direction 2026-11-09): a thread, not single
 * questions. Earlier turns of the visit go back with each question so MAIA
 * builds on them; the astrologer may ask for depth, widen a natal question to
 * the other systems, and — for their OWN chart only, chosen each time — have
 * MAIA read it with what they have chosen to keep with her.
 */
import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/http/apiBase';
import type { ProAskDepth, ProAskMode, ProAskSection, ProAskView } from '@/lib/astrology/proAskMaiaSections';
import { usePanelState } from './panelMemory';
import { useMaiaDock, useMaiaSubject } from './maiaDock';
import styles from './pro-ask-maia.module.css';

export interface ProAskRequest {
  section: ProAskSection;
  subject: string;
  other?: string;
  houseSystem?: string;
  at?: string;
  dayStart?: 'midnight' | 'zi-hour';
  direction?: 'forward' | 'backward' | null;
  ayanamsa?: string;
  /** The cockpit view that is open, from the server's fixed list. */
  view?: ProAskView;
  /** A body of this chart the astrologer has selected. */
  point?: string;
}

const ERRORS: Record<string, string> = {
  slow_down: 'That was a lot of questions at once. Please wait a minute and ask again.',
  question_too_long: 'Please shorten the question a little.',
  saved_chart_not_found: 'That saved chart is no longer here.',
  complete_birth_details_required: 'This chart needs a complete birth date, time and place.',
  session_required: 'Please sign in again.',
  personal_own_chart_only: 'MAIA can bring what she knows of you only to your own chart.',
};

/** Deleting a conversation leaves what the member carried into MAIA's memory; say so, and where it lives. */
const CARRIED_NOTE = ' What you kept with MAIA stays in her memory until you remove it in Keep.';
const START_OVER_CONFIRM = (carried: boolean) =>
  `Start over? The conversation kept so far will be deleted.${carried ? CARRIED_NOTE : ''}`;
const STOP_KEEPING_CONFIRM = (carried: boolean) =>
  `Stop keeping this conversation? What was kept will be deleted.${carried ? CARRIED_NOTE : ''}`;

/** How many earlier turns go back with a question (the server's limit). */
const HISTORY_TURNS = 8;

interface Exchange {
  q: string; a: string; safety?: boolean; mentor?: boolean; keptUsed?: number;
  /** MAIA's stored turn, when the exchange is kept: what "Keep with MAIA" names. */
  turnIndex?: number;
  /** The member carried this exchange into MAIA's memory (ASTRO-PRO-KEEP Phase 2). */
  carried?: boolean;
  /** Earlier kept conversations about this chart that MAIA read for this answer. */
  recalledUsed?: number;
}

export function askKey(request: ProAskRequest): string {
  return `ask.${request.section}.${request.subject}.${request.other ?? ''}`;
}

/** Ways in, for an empty conversation. They fill the box; the astrologer sends. */
function starters(request: ProAskRequest, mode: ProAskMode, personal: boolean): string[] {
  if (mode === 'mentor') {
    const byS: Partial<Record<ProAskSection, string[]>> = {
      transits: ['How do I weigh which transits matter?', 'What do applying and separating change in a reading?'],
      progressed: ['How do secondary progressions differ from solar arcs?', 'What do I look at first in a progressed chart?'],
      biwheel: ['How do I read synastry without reducing two people to a score?'],
      composite: ['What is a composite chart actually a chart of?'],
      'four-pillars': ['How are the ten-year cycles counted, and why does direction matter?', 'What are the Ten Gods, and how do schools differ on them?'],
      vedic: ['How does the Vimshottari dasha system work?', 'How does a nakshatra change the reading of a graha?'],
      mayan: ['How does the Chol Q’ij count work, and how do daykeepers keep it?', 'How does the traditional count differ from the Dreamspell?'],
    };
    return byS[request.section] ?? ['How do I find the central structure of a chart?', 'How do different schools read a T-square?', 'What should I look at first, and why?'];
  }
  if (personal) return ['What is this season of my life asking of me?', 'Where does my chart meet what I have been working with?', 'What am I not seeing?'];
  const byS: Partial<Record<ProAskSection, string[]>> = {
    transits: ['Which of these transits matters most, and why?', 'What is the longer movement behind these?'],
    progressed: ['What has shifted by progression?', 'What do the solar arcs bring forward?'],
    biwheel: ['Where do these two charts meet most strongly?', 'What is the growing edge between them?'],
    composite: ['What is this relationship, as its own entity?'],
    'four-pillars': ['What does the current ten-year cycle bring?', 'How does the day master sit among the elements?'],
    vedic: ['What does the current dasha ask?', 'What does the birth nakshatra add to the picture?'],
    mayan: ['How is this Chol Q’ij birth day counted, and where does it fall in its trecena?', 'How do the traditional day and the separate Dreamspell signature differ?'],
  };
  return byS[request.section] ?? [
    'What is the central structure of this chart?',
    ...(request.point ? [`What stands out about ${request.point} here?`] : []),
    'Where is the tension, and where is the ease?',
  ];
}

/** The conversation about one subject: the thread, the ways in, and the box to ask. */
export function ProAskMaiaConversation({ request, readsWhose, mode = 'ask', stage = false }: {
  request: ProAskRequest;
  readsWhose: string;
  mode?: ProAskMode;
  /** In the cockpit's conversation stage: depth, breadth and the personal reading are offered. */
  stage?: boolean;
}) {
  const key = askKey(request);
  const [question, setQuestion] = usePanelState(`${key}.draft`, '');
  const [exchanges, setExchanges] = usePanelState<Exchange[]>(`${key}.log`, []);
  // Natal only: transits on a date the astrologer chooses (an event, an anniversary).
  const [onDate, setOnDate] = usePanelState(`${key}.date`, '');
  // Progressions only: a period to look across, from this date to the chosen one.
  const [since, setSince] = usePanelState(`${key}.since`, '');
  const [depth, setDepth] = usePanelState<ProAskDepth>(`${key}.depth`, 'brief');
  // Natal only: draw the other systems into the question.
  const [whole, setWhole] = usePanelState(`${key}.whole`, false);
  // Own chart only, and off until the astrologer turns it on for this conversation.
  const [personal, setPersonal] = usePanelState(`${key}.personal`, false);
  // Kept conversation: on unless the astrologer turns it off for this conversation.
  const [threadId, setThreadId] = usePanelState<string | null>(`${key}.threadId`, null);
  const [keep, setKeep] = usePanelState(`${key}.keep`, true);
  const [status, setStatus] = useState<'idle' | 'asking'>('idle');
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const mentor = mode === 'mentor';
  const natal = request.section === 'natal';
  const twoCharts = request.other !== undefined;
  const canBePersonal = stage && request.subject === 'own' && !twoCharts;
  // Keep with MAIA (ASTRO-PRO-KEEP Phase 2): own chart alone, kept conversations only.
  const canCarry = request.subject === 'own' && !twoCharts && keep && !!threadId;
  const [carrying, setCarrying] = useState<number | null>(null);
  const withMe = canBePersonal && personal && !mentor;

  // Resume: when the log is empty, bring back the latest kept conversation for this subject.
  useEffect(() => {
    if (exchanges.length > 0 || !keep) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/astrology/pro/conversation?subjectKey=${encodeURIComponent(key)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json().catch(() => null);
        if (cancelled || !body || typeof body.threadId !== 'string' || !Array.isArray(body.turns)) return;
        const turns = (body.turns as Array<{ q?: unknown; a?: unknown; turnIndex?: unknown; carried?: unknown }>)
          .filter((t) => typeof t.q === 'string' && typeof t.a === 'string')
          .map((t) => ({
            q: t.q as string, a: t.a as string,
            ...(typeof t.turnIndex === 'number' ? { turnIndex: t.turnIndex } : {}),
            ...(t.carried === true ? { carried: true } : {}),
          }));
        if (turns.length === 0) return;
        setThreadId(body.threadId);
        setExchanges((list) => (list.length > 0 ? list : turns));
      } catch { /* resuming is best effort; the panel works without it */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /** Deletes the kept conversation, after the member confirms. False if they cancel or it fails. */
  async function deleteKept(confirmText: string): Promise<boolean> {
    if (!threadId) return true;
    if (typeof window !== 'undefined' && !window.confirm(confirmText)) return false;
    try {
      const res = await apiFetch('/api/astrology/pro/conversation', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ threadId, keep: false }),
      });
      if (!res.ok && res.status !== 404) { setError('Could not delete the kept conversation just now. Please try again.'); return false; }
    } catch {
      setError('Could not delete the kept conversation just now. Please try again.');
      return false;
    }
    setThreadId(null);
    return true;
  }

  async function changeKeep(next: boolean) {
    if (next) { setKeep(true); return; }
    if (await deleteKept(STOP_KEEPING_CONFIRM(exchanges.some((e) => e.carried)))) setKeep(false);
  }

  // One kept conversation per subject: starting over deletes the kept one, so
  // nothing is left stored that the member can no longer reach or remove.
  async function startOver() {
    if (keep && !(await deleteKept(START_OVER_CONFIRM(exchanges.some((e) => e.carried))))) return;
    setExchanges([]);
    setThreadId(null);
  }

  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [exchanges.length, status]);

  async function ask(text?: string) {
    const q = (text ?? question).trim();
    if (status === 'asking') return;
    if (!q) { setError('Enter a question first.'); return; }
    setStatus('asking');
    setError(null);
    try {
      const reply = await apiFetch('/api/astrology/pro/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({
          ...request,
          ...(natal && onDate ? { at: `${onDate}T12:00:00` } : {}),
          ...(request.section === 'progressed' && since ? { from: `${since}T12:00:00` } : {}),
          ...(mentor ? { mode: 'mentor' } : {}),
          ...(stage && depth === 'deep' ? { depth: 'deep' } : {}),
          ...(stage && natal && whole ? { include: ['four-pillars', 'progressions', 'maya'] } : {}),
          ...(withMe ? { personal: true } : {}),
          // The earlier turns of this visit, so MAIA builds on them. A safety reply is not a turn.
          ...(stage && exchanges.some((e) => !e.safety)
            ? { history: exchanges.filter((e) => !e.safety).slice(-HISTORY_TURNS).map((e) => ({ q: e.q, a: e.a })) } : {}),
          subjectKey: key,
          keep,
          ...(keep && threadId ? { threadId } : {}),
          question: q,
        }),
      });
      const body = await reply.json().catch(() => ({}));
      if (!reply.ok || typeof body?.answer !== 'string') {
        setError(ERRORS[body?.error] || 'MAIA could not answer just now. Please try again.');
        return;
      }
      if (keep && typeof body.threadId === 'string') setThreadId(body.threadId);
      setExchanges((list) => [...list, {
        q, a: body.answer, safety: body.safety === true, mentor,
        ...(typeof body.keptUsed === 'number' ? { keptUsed: body.keptUsed } : {}),
        ...(typeof body.turnIndex === 'number' ? { turnIndex: body.turnIndex } : {}),
        ...(typeof body.recalledUsed === 'number' ? { recalledUsed: body.recalledUsed } : {}),
      }]);
      if (text === undefined) setQuestion('');
    } catch {
      setError('MAIA could not answer just now. Please try again.');
    } finally {
      setStatus('idle');
    }
  }

  /** One press carries one exchange into MAIA's memory. The member's own act; nothing else is carried. */
  async function carry(i: number) {
    const e = exchanges[i];
    if (!threadId || typeof e?.turnIndex !== 'number' || e.carried || carrying !== null) return;
    setCarrying(i);
    setError(null);
    try {
      const res = await apiFetch('/api/astrology/pro/conversation/carry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ threadId, turnIndex: e.turnIndex }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.carried !== true) { setError('Could not keep this with MAIA just now. Please try again.'); return; }
      setExchanges((list) => list.map((x, j) => (j === i ? { ...x, carried: true } : x)));
    } catch {
      setError('Could not keep this with MAIA just now. Please try again.');
    } finally {
      setCarrying(null);
    }
  }

  const last = exchanges[exchanges.length - 1];

  return (
    <>
      <p className={styles.note}>
        MAIA will read {readsWhose} to answer: only the calculated facts of this section, not names or birth
        details. MAIA is an AI, not the astrologer.
      </p>
      <label className={styles.check}>
        <input type="checkbox" role="switch" checked={keep} disabled={status === 'asking'} onChange={(e) => void changeKeep(e.target.checked)} />
        Keep this conversation
      </label>
      <p className={styles.note}>
        {keep ? 'Kept — you can come back to this conversation.' : 'Not kept — this conversation ends when you leave.'}
        {keep && request.subject === 'own' && !twoCharts && ' MAIA’s wider memory holds only what you choose: press “Keep with MAIA” on an answer.'}
        {keep && request.subject !== 'own' && ' This stays with this chart only and never enters your own memory with MAIA.'}
      </p>

      {stage && (
        <div className={styles.options}>
          <div className={styles.segment} role="group" aria-label="How full an answer">
            <button type="button" aria-pressed={depth === 'brief'} onClick={() => setDepth('brief')}>Brief</button>
            <button type="button" aria-pressed={depth === 'deep'} onClick={() => setDepth('deep')}>In depth</button>
          </div>
          {natal && (
            <label className={styles.check}>
              <input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} />
              Draw on all systems (progressions, Four Pillars, Maya count)
            </label>
          )}
          {canBePersonal && !mentor && (
            <label className={styles.check}>
              <input type="checkbox" checked={personal} onChange={(e) => setPersonal(e.target.checked)} />
              Read this with what you know about me
            </label>
          )}
        </div>
      )}
      {withMe && (
        <p className={styles.personalNote}>
          MAIA will also read what you have chosen to keep with her and allowed to return. It informs this answer
          only. {keep ? 'This conversation is kept for you to return to' : 'This conversation is not kept'}, and your chart
          is added to MAIA’s memory only where you press “Keep with MAIA”.
        </p>
      )}

      {natal && (
        <label className={styles.dateField}>
          Include transits on (optional)
          <input type="date" value={onDate} onChange={(e) => setOnDate(e.target.value)} />
          {onDate && <button type="button" onClick={() => setOnDate('')}>Remove date</button>}
        </label>
      )}
      {request.section === 'progressed' && (
        <>
          <p className={styles.note}>MAIA reads the progressions and solar arcs for the date chosen in Progressions.</p>
          <label className={styles.dateField}>
            Look across a period since (optional, up to 10 years)
            <input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
            {since && <button type="button" onClick={() => setSince('')}>Remove</button>}
          </label>
        </>
      )}
      {request.section === 'transits' && request.at && (
        <p className={styles.note}>
          MAIA reads the sky on {new Date(request.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}, the moment shown in Transits. Change it there to ask about another date.
        </p>
      )}

      <div className={stage ? styles.thread : undefined} aria-live="polite">
        {exchanges.map((e, i) => (
          <div key={i} className={styles.exchange}>
            <p className={styles.q}>{e.mentor ? 'Mentor · ' : ''}{e.q}</p>
            <p className={e.safety ? `${styles.a} ${styles.safety}` : styles.a}>{e.a}</p>
            {typeof e.recalledUsed === 'number' && e.recalledUsed > 0 && (
              <p className={styles.provenance}>
                MAIA also read {e.recalledUsed} earlier kept exchange{e.recalledUsed === 1 ? '' : 's'} about this chart.
              </p>
            )}
            {canCarry && !e.safety && typeof e.turnIndex === 'number' && (
              e.carried
                ? <p className={styles.provenance}>Kept with MAIA. You can see, seal or archive it in Keep.</p>
                : (
                  <button type="button" className={styles.carry} disabled={carrying !== null || status === 'asking'}
                    onClick={() => void carry(i)}>
                    {carrying === i ? 'Keeping…' : 'Keep with MAIA'}
                  </button>
                )
            )}
            {typeof e.keptUsed === 'number' && (
              <p className={styles.provenance}>
                {e.keptUsed === 0
                  ? 'You have kept nothing with MAIA that may be brought here, so this is the chart alone.'
                  : `MAIA read this with ${e.keptUsed} thing${e.keptUsed === 1 ? '' : 's'} you have kept with her.`}
              </p>
            )}
          </div>
        ))}
        {status === 'asking' && <p className={styles.waiting} role="status">MAIA is reading…</p>}
        <div ref={end} />
      </div>

      {stage && last && !last.safety && status === 'idle' && (
        <div className={styles.chips}>
          <button type="button" onClick={() => void ask('Say more about that.')}>Say more</button>
          <button type="button" onClick={() => void ask('Say that again, shorter.')}>Shorter, please</button>
          <button type="button" onClick={() => void ask(mentor ? 'Show me that on this chart, as an example.' : 'What would you look at next?')}>
            {mentor ? 'Show me on this chart' : 'What next?'}
          </button>
        </div>
      )}
      {stage && exchanges.length === 0 && (
        <div className={styles.chips} aria-label="Ways to begin">
          {starters(request, mode, withMe).map((text) => (
            <button key={text} type="button" onClick={() => { setQuestion(text); if (error) setError(null); }}>{text}</button>
          ))}
        </div>
      )}

      <textarea value={question} rows={stage ? 2 : 3} maxLength={600}
        aria-label={mentor ? 'Your question for MAIA as mentor' : 'Your question for MAIA'}
        onChange={(e) => { setQuestion(e.target.value); if (error) setError(null); }}
        placeholder={mentor ? 'Which technique would you like to go deeper into?' : 'What would you like MAIA’s view on?'}
        disabled={status === 'asking'}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (stage && !e.shiftKey))) { e.preventDefault(); void ask(); } }} />
      {error && <p role="alert" className={styles.alert}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" onClick={() => void ask()} disabled={status === 'asking'}>
          {status === 'asking' ? 'MAIA is reading…' : mentor ? 'Ask the mentor' : 'Ask MAIA'}
        </button>
        {exchanges.length > 0 && <button type="button" onClick={() => void startOver()} disabled={status === 'asking'}>Start over</button>}
      </div>
    </>
  );
}

export default function ProAskMaiaPanel({ request, readsWhose, subjectLabel }: {
  request: ProAskRequest;
  /** Whose charts MAIA will read, said before anything is sent: "Tim's chart", "Owen's and Tim's charts". */
  readsWhose: string;
  /** What the panel is about, for its heading: "the composite", "these transits". */
  subjectLabel: string;
}) {
  const key = askKey(request);
  const dock = useMaiaDock();
  useMaiaSubject(dock ? { key, request, readsWhose, subjectLabel } : null);
  const [open, setOpen] = usePanelState(`${key}.open`, false);

  if (dock) {
    return (
      <div className={styles.closed}>
        <button type="button" onClick={() => dock.focus(key)}>
          <Sparkles size={14} aria-hidden="true" /> Talk with MAIA about {subjectLabel}
        </button>
      </div>
    );
  }
  if (!open) {
    return (
      <div className={styles.closed}>
        <button type="button" onClick={() => setOpen(true)}>Ask MAIA about {subjectLabel}</button>
      </div>
    );
  }
  return (
    <div className={styles.panel} role="group" aria-label={`Ask MAIA about ${subjectLabel}`}>
      <div className={styles.head}>
        <strong>Ask MAIA about {subjectLabel}</strong>
        <button type="button" onClick={() => setOpen(false)}>Close</button>
      </div>
      <ProAskMaiaConversation request={request} readsWhose={readsWhose} />
    </div>
  );
}
