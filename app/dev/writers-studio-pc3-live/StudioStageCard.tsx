'use client';

/**
 * Where the writer is in their program's arc, and that stage's own words (founder 2026-11-16: "We want all phases of writing
 * process for College essay ready to test"). The words are the program's curriculum (registry). Coaching stays outside the editor.
 *
 * ⭐ The writer moves stages; nothing advances by itself.
 * ⭐ Notes and checklist ticks are PRIVATE BY DEFAULT (founder: "Yes, private by default"). MAIA reads a note only when the writer
 *    presses "Show MAIA this note", which puts it in the conversation box as the writer's own message for her to send.
 * ⭐ Tools beside the page: "Keep a version" (the Studio's existing server-truth checkpoint) and the Revision Mirror, which shows
 *    only exact differences between the writer's OWN versions: "My changes, not AI's". It never suggests wording.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/http/apiBase';
import { builtStages, currentStage, nextStage, type StudioPath } from '@/lib/writersStudio/studioPaths';
import { wordDiff, type DiffPart } from '@/lib/writersStudio/wordDiff';
import type { SectionWriting } from '@/lib/writersStudio/useSectionWriting';
import { KeepAVersion } from '@/app/writers-studio/canvas/SectionWritingSurface';

type Save = 'idle' | 'saving' | 'saved' | 'error';
type Note = { body: string; checks: string[] };
type Revision = { revisionNumber: number; createdAt: string; note: string | null };

export default function StudioStageCard(props: {
  workId: string;
  program: StudioPath;
  declaredStage: string | null | undefined;
  /** Words in the writer's current draft (for Draft's informational range). */
  draftWords: number;
  /** Opens the conversation with this text as the writer's own unsent message. */
  onShowMaia: (text: string) => void;
  /** For "Keep a version" and the Revision Mirror. Absent ⇒ those tools are not shown. */
  manuscriptId?: string;
  writing?: SectionWriting;
  /** The writer's current draft text, compared against a version they kept. */
  currentText?: string;
}) {
  const stages = builtStages(props.program);
  const [stageId, setStageId] = useState(() => currentStage(props.program, props.declaredStage).id);
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [draft, setDraft] = useState('');
  const [checks, setChecks] = useState<string[]>([]);
  const [save, setSave] = useState<Save>('idle');
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [mirror, setMirror] = useState<{ n: number; parts: DiffPart[] | null } | 'loading' | 'error' | null>(null);
  const stage = currentStage(props.program, stageId);
  const next = nextStage(props.program, stage.id);
  const index = stages.findIndex((s) => s.id === stage.id);
  const tools = stage.tools ?? [];

  // One Work's notes never show in another's card.
  useEffect(() => {
    setStageId(currentStage(props.program, props.declaredStage).id);
  }, [props.workId, props.program, props.declaredStage]);
  useEffect(() => {
    let live = true;
    setNotes({});
    void (async () => {
      try {
        const r = await apiFetch(`/api/sovereign/living-works/${encodeURIComponent(props.workId)}/stage-notes`, { method: 'GET' });
        const b = await r.json().catch(() => null) as { notes?: { stage: string; body: string; checks?: string[] }[] } | null;
        if (!live || !r.ok) return;
        setNotes(Object.fromEntries((b?.notes ?? []).map((n) => [n.stage, { body: n.body, checks: n.checks ?? [] }])));
      } catch { /* the card still works; notes simply aren't shown */ }
    })();
    return () => { live = false; };
  }, [props.workId]);
  useEffect(() => {
    setDraft(notes[stage.id]?.body ?? '');
    setChecks(notes[stage.id]?.checks ?? []);
    setSave('idle');
  }, [stage.id, notes]);

  const persist = useCallback(async (body: string, ticks: string[]) => {
    const saved = notes[stage.id];
    if ((saved?.body ?? '') === body && JSON.stringify(saved?.checks ?? []) === JSON.stringify(ticks)) return;
    setSave('saving');
    try {
      const r = await apiFetch(`/api/sovereign/living-works/${encodeURIComponent(props.workId)}/stage-notes`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stage: stage.id, body, checks: ticks }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setNotes((n) => ({ ...n, [stage.id]: { body, checks: ticks } }));
      setSave('saved');
    } catch { setSave('error'); }
  }, [notes, props.workId, stage.id]);

  const loadRevisions = useCallback(async () => {
    if (!props.manuscriptId) return;
    try {
      const r = await apiFetch(`/api/sovereign/manuscripts/${encodeURIComponent(props.manuscriptId)}/draft/revisions`, { method: 'GET' });
      const b = await r.json().catch(() => null) as { revisions?: Revision[] } | null;
      setRevisions(r.ok ? (b?.revisions ?? []) : []);
    } catch { setRevisions([]); }
  }, [props.manuscriptId]);
  useEffect(() => { if (tools.includes('mirror')) void loadRevisions(); }, [tools.includes('mirror'), loadRevisions]); // eslint-disable-line react-hooks/exhaustive-deps

  const compare = async (n: number) => {
    if (!props.manuscriptId) return;
    setMirror('loading');
    try {
      const r = await apiFetch(`/api/sovereign/manuscripts/${encodeURIComponent(props.manuscriptId)}/draft/revisions/${n}`, { method: 'GET' });
      const b = await r.json().catch(() => null) as { content?: unknown } | null;
      if (!r.ok || typeof b?.content !== 'string') throw new Error(String(r.status));
      setMirror({ n, parts: wordDiff(b.content, props.currentText ?? '') });
    } catch { setMirror('error'); }
  };

  const moveTo = async (id: string) => {
    if (id === stage.id || moving) return;
    await persist(draft, checks);
    setMoving(true);
    setMoveError(null);
    try {
      const r = await apiFetch(`/api/sovereign/living-works/${encodeURIComponent(props.workId)}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ studioStage: id }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setStageId(id);
      setMirror(null);
    } catch {
      setMoveError('That didn’t move just now. You’re still where you were, and nothing was lost.');
    } finally { setMoving(false); }
  };

  return (
    <section className="p4r1-stage-card" data-studio-stage={stage.id} aria-label={`${props.program.name}: ${stage.stage}`}>
      <ol className="p4r1-stage-strip" aria-label="Stages">
        {stages.map((s, i) => (
          <li key={s.id}>
            <button type="button" aria-current={s.id === stage.id ? 'step' : undefined} data-stage-button={s.id}
              disabled={moving} onClick={() => void moveTo(s.id)}>
              <span aria-hidden="true">{i < index ? '✓ ' : ''}</span>{s.stage}
            </button>
          </li>
        ))}
      </ol>
      <p className="p4r1-eyebrow">Stage {index + 1} of {stages.length} · {stage.stage}</p>
      {stage.lead ? <h3 className="p4r1-stage-lead">{stage.lead}</h3> : null}
      {stage.guidance ? <p className="p4r1-stage-guidance">{stage.guidance}</p> : null}
      {stage.prompt || stage.question ? (
        <p className="p4r1-stage-question">{stage.prompt ? <b>{stage.prompt}. </b> : null}{stage.question}</p>
      ) : null}
      {stage.id === 'draft' ? (
        <p className="p4r1-stage-info" data-stage-words>{props.draftWords.toLocaleString()} words. {stage.info}</p>
      ) : stage.info ? <p className="p4r1-stage-info">{stage.info}</p> : null}

      {stage.checklist?.length ? (
        <fieldset className="p4r1-stage-checklist" data-stage-checklist>
          <legend>My personal readiness check</legend>
          {stage.checklist.map((c) => (
            <label key={c.id} className="p4r1-stage-check">
              <input type="checkbox" data-check={c.id} checked={checks.includes(c.id)}
                onChange={(e) => {
                  const ticks = e.target.checked ? [...checks, c.id] : checks.filter((x) => x !== c.id);
                  setChecks(ticks);
                  void persist(draft, ticks);
                }} />
              <span>{c.label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <label className="p4r1-stage-notes-label" htmlFor={`stage-notes-${props.workId}`}>{stage.notesLabel ?? 'My notes'}</label>
      <textarea id={`stage-notes-${props.workId}`} className="p4r1-stage-notes" value={draft} maxLength={20000}
        onChange={(e) => { setDraft(e.target.value); setSave('idle'); }} onBlur={() => void persist(draft, checks)} rows={4} />
      <p className="p4r1-stage-private">
        Private. MAIA sees this only if you show her.
        {save === 'saving' ? ' Saving…' : save === 'saved' ? ' Saved.' : save === 'error' ? ' Not saved just now; your words are still here.' : ''}
      </p>

      {tools.includes('keep') && props.writing && props.manuscriptId ? (
        <div className="p4r1-stage-keep" data-stage-keep>
          <KeepAVersion writing={props.writing} manuscriptId={props.manuscriptId} onCheckpointed={() => void loadRevisions()} />
        </div>
      ) : null}

      {tools.includes('mirror') && props.manuscriptId ? (
        <div className="p4r1-stage-mirror" data-stage-mirror>
          <p className="p4r1-eyebrow">Revision Mirror · My changes, not AI’s</p>
          <p className="p4r1-stage-info">Compare a version you kept with your current draft. It shows only the exact differences between your own words. It never writes into your essay or suggests wording.</p>
          {revisions === null ? <p className="p4r1-stage-info" role="status">Looking for your kept versions…</p>
            : revisions.length === 0 ? <p className="p4r1-stage-info" data-mirror-empty>Keep a version of your draft first; then you can compare it with what you write next.</p>
            : (
              <div className="p4r1-stage-actions">
                {revisions.slice(0, 6).map((v) => (
                  <button key={v.revisionNumber} type="button" className="p4r1-talk" data-mirror-version={v.revisionNumber}
                    aria-pressed={typeof mirror === 'object' && mirror?.n === v.revisionNumber}
                    onClick={() => void compare(v.revisionNumber)}>
                    Version {v.revisionNumber} · {new Date(v.createdAt).toLocaleDateString()}
                  </button>
                ))}
              </div>
            )}
          {mirror === 'loading' ? <p className="p4r1-stage-info" role="status">Comparing your versions…</p> : null}
          {mirror === 'error' ? <p className="p4r1-error" role="alert">That version couldn’t be opened just now. Nothing changed.</p> : null}
          {mirror && typeof mirror === 'object' ? (
            mirror.parts === null
              ? <p className="p4r1-stage-info">These versions are too long to compare here.</p>
              : (
                <p className="p4r1-stage-diff" data-mirror-diff>
                  {mirror.parts.map((p, i) => p.kind === 'same'
                    ? <span key={i}>{p.text} </span>
                    : p.kind === 'earlier'
                      ? <del key={i} data-diff="earlier" title="Only in the earlier version">{p.text} </del>
                      : <ins key={i} data-diff="current" title="Only in your current draft">{p.text} </ins>)}
                </p>
              )
          ) : null}
          {mirror && typeof mirror === 'object' && mirror.parts ? (
            <p className="p4r1-stage-info">Struck through: only in the earlier version. Underlined: only in your current draft. The interpretation is yours.</p>
          ) : null}
        </div>
      ) : null}

      <div className="p4r1-stage-actions">
        <button type="button" className="p4r1-talk" disabled={draft.trim() === ''} data-stage-show-maia
          onClick={() => props.onShowMaia(`From my ${stage.stage} notes: ${draft.trim()}`)}>Show MAIA this note</button>
        {next ? (
          <button type="button" className="p4r1-talk" disabled={moving} data-stage-next onClick={() => void moveTo(next.id)}>
            Move on to {next.stage} →
          </button>
        ) : null}
      </div>
      {moveError ? <p className="p4r1-error" role="alert">{moveError}</p> : null}
    </section>
  );
}
