'use client';

/**
 * Where the writer is in their program's arc, and that stage's own words (founder 2026-11-16: "We want all phases of writing
 * process for College essay ready to test"). The words are the program's curriculum (registry). Coaching stays outside the editor.
 *
 * ⭐ The writer moves stages; nothing advances by itself.
 * ⭐ Notes are PRIVATE BY DEFAULT (founder: "Yes, private by default"). MAIA reads a note only when the writer presses
 *    "Show MAIA this note", which puts it in the conversation box as the writer's own message for her to send.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/http/apiBase';
import { builtStages, currentStage, nextStage, type StudioPath } from '@/lib/writersStudio/studioPaths';

type Save = 'idle' | 'saving' | 'saved' | 'error';

export default function StudioStageCard(props: {
  workId: string;
  program: StudioPath;
  declaredStage: string | null | undefined;
  /** Words in the writer's current draft (for Draft's informational range). */
  draftWords: number;
  /** Opens the conversation with this text as the writer's own unsent message. */
  onShowMaia: (text: string) => void;
}) {
  const stages = builtStages(props.program);
  const [stageId, setStageId] = useState(() => currentStage(props.program, props.declaredStage).id);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [save, setSave] = useState<Save>('idle');
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const stage = currentStage(props.program, stageId);
  const next = nextStage(props.program, stage.id);
  const index = stages.findIndex((s) => s.id === stage.id);

  // One Work's notes never show in another's card.
  useEffect(() => {
    setStageId(currentStage(props.program, props.declaredStage).id);
  }, [props.workId, props.program, props.declaredStage]);
  useEffect(() => {
    let live = true;
    loadedFor.current = null;
    setNotes({});
    void (async () => {
      try {
        const r = await apiFetch(`/api/sovereign/living-works/${encodeURIComponent(props.workId)}/stage-notes`, { method: 'GET' });
        const b = await r.json().catch(() => null) as { notes?: { stage: string; body: string }[] } | null;
        if (!live || !r.ok) return;
        setNotes(Object.fromEntries((b?.notes ?? []).map((n) => [n.stage, n.body])));
        loadedFor.current = props.workId;
      } catch { /* the card still works; notes simply aren't shown */ }
    })();
    return () => { live = false; };
  }, [props.workId]);
  useEffect(() => { setDraft(notes[stage.id] ?? ''); setSave('idle'); }, [stage.id, notes]);

  const saveNote = useCallback(async () => {
    if ((notes[stage.id] ?? '') === draft) return;
    setSave('saving');
    try {
      const r = await apiFetch(`/api/sovereign/living-works/${encodeURIComponent(props.workId)}/stage-notes`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stage: stage.id, body: draft }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setNotes((n) => ({ ...n, [stage.id]: draft }));
      setSave('saved');
    } catch { setSave('error'); }
  }, [draft, notes, props.workId, stage.id]);

  const moveTo = async (id: string) => {
    if (id === stage.id || moving) return;
    await saveNote();
    setMoving(true);
    setMoveError(null);
    try {
      const r = await apiFetch(`/api/sovereign/living-works/${encodeURIComponent(props.workId)}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ studioStage: id }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setStageId(id);
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
      <label className="p4r1-stage-notes-label" htmlFor={`stage-notes-${props.workId}`}>{stage.notesLabel ?? 'My notes'}</label>
      <textarea id={`stage-notes-${props.workId}`} className="p4r1-stage-notes" value={draft} maxLength={20000}
        onChange={(e) => { setDraft(e.target.value); setSave('idle'); }} onBlur={() => void saveNote()} rows={4} />
      <p className="p4r1-stage-private">
        Private. MAIA sees this only if you show her.
        {save === 'saving' ? ' Saving…' : save === 'saved' ? ' Saved.' : save === 'error' ? ' Not saved just now; your words are still here.' : ''}
      </p>
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
