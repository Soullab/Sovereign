'use client';
/**
 * "What is it becoming?" for a new Work begun from Home (founder 2026-11-21, "Yes, add it here"): the same optional question the
 * first-visit opening asks, so every new Work can be named by its writer. The writer's click or own word is the only source;
 * nothing is guessed from the title or the spark. A guided path that fits the chosen form is offered, never taken for them.
 */
import { useState } from 'react';
import { FORM_CHOICES, FORM_MAX_CHARS, FORM_OWN_WORD_LABEL, FORM_QUESTION, formToSave, type FormChoice } from '@/lib/writersStudio/formVocabulary';
import { pathsForForm } from '@/lib/writersStudio/studioPaths';

export default function FormQuestion(props: {
  onChange: (form: string | null) => void;
  /** Open a guided path's own door (its age question first). Absent: no path is offered. */
  onChoosePath?: (pathId: string) => void;
}) {
  const [choice, setChoice] = useState<FormChoice | null>(null);
  const [own, setOwn] = useState('');
  const [ownOpen, setOwnOpen] = useState(false);
  const form = formToSave(choice, ownOpen ? own : '');
  const pick = (next: FormChoice | null, nextOwn: string, nextOwnOpen: boolean) => {
    setChoice(next); setOwn(nextOwn); setOwnOpen(nextOwnOpen);
    props.onChange(formToSave(next, nextOwnOpen ? nextOwn : ''));
  };
  return (
    <div className="p4r1-home-form-question" data-form-question>
      <p id="p4r1-work-form-q">{FORM_QUESTION} <span className="wsio-optional">Optional. You can change it any time.</span></p>
      <div className="wsio-posture" role="group" aria-labelledby="p4r1-work-form-q" data-form-choices>
        {FORM_CHOICES.map((f) => (
          <button key={f.id} type="button" aria-pressed={choice === f.id}
            onClick={() => pick(choice === f.id ? null : f.id, '', false)}>{f.label}</button>
        ))}
        <button type="button" aria-pressed={ownOpen} onClick={() => pick(null, own, !ownOpen)}>{FORM_OWN_WORD_LABEL}</button>
      </div>
      {ownOpen ? (
        <div>
          <input aria-label={FORM_OWN_WORD_LABEL} value={own} maxLength={FORM_MAX_CHARS}
            onChange={(e) => pick(null, e.target.value, true)} />
        </div>
      ) : null}
      {props.onChoosePath ? pathsForForm(form).map((path) => (
        <p key={path.id} className="wsio-note" data-path-offer={path.id}>
          {path.offer}{' '}
          <button type="button" className="wsio-link" onClick={() => props.onChoosePath?.(path.id)}>{path.startLabel}</button>
        </p>
      )) : null}
    </div>
  );
}
