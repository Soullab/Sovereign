'use client';

import { useEffect, useRef, useState } from 'react';
import { usePersistentListening } from '@/components/listening/PersistentListeningProvider';
import {
  DEFAULT_TONE_DIAL, NO_CLAIM_NOTE, PULSE_MAX_HZ, PULSE_MIN_HZ, PULSE_MODES, TONE_BEDS, TONE_MAX_HZ, TONE_MIN_HZ,
  TONE_PRESETS, applyPreset, clampPulseHz, clampToneHz, toneNotes, toneSoundscapeSpec,
} from '@/lib/listening/toneLab';
import type { PulseMode, ToneBed, ToneDial } from '@/lib/listening/toneLab';
import styles from './listen.module.css';

// TONE-LAB-01 · an instrument for exploring a tone and a pulse. It starts nothing by itself: Play is the member's
// own act, and the sound goes through the one persistent player (its level control, its Stop, its single-source
// rules). Copy here is scanned by tests/listening/tone_lab.test.mjs; it never promises an effect.
const GROUPS = ['Solfeggio tradition', 'Reference pitch', 'Earth resonance', 'Rhythm rates'] as const;

export default function ToneLabDesk() {
  const transport = usePersistentListening();
  const [dial, setDial] = useState<ToneDial>(DEFAULT_TONE_DIAL);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const preset = TONE_PRESETS.find(p => p.id === presetId) ?? null;
  const live = transport?.snapshot.kind === 'sketch' && transport.snapshot.playback === 'playing' && transport.snapshot.title === 'Tone Lab';
  const first = useRef(true);
  const liveRef = useRef(live);
  liveRef.current = live;

  const change = (next: Partial<ToneDial>, keepPreset = false) => {
    setDial(old => ({ ...old, ...next }));
    if (!keepPreset) setPresetId(null);
  };

  // While a Tone Lab sound the member started is playing, the dial moves it smoothly. Nothing here ever starts sound.
  useEffect(() => {
    if (first.current) { first.current = false; return; } // opening the Lab never changes a running sound
    if (!liveRef.current || !transport) return;
    const timer = window.setTimeout(() => {
      if (liveRef.current) void transport.playSketch('focus', [110, 164.81, 220], undefined, toneSoundscapeSpec(dial));
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dial]);

  const play = async () => {
    if (!transport) return;
    const started = await transport.playSketch('focus', [110, 164.81, 220], undefined, toneSoundscapeSpec(dial));
    setMessage(started
      ? 'Playing. Level, Pause and Stop are in the player bar.'
      : 'Sound did not start. Another Soullab sound may be active, or MAIA may be speaking.');
  };

  const notes = toneNotes(dial);
  return (
    <section className={styles.toneLab} aria-labelledby="tone-lab-title" data-tone-lab="true">
      <span className={styles.smallcaps}>TONE LAB</span>
      <h2 id="tone-lab-title">Listen to a tone. Explore a pulse.</h2>
      <p className={styles.muted} data-tone-lab-claim="true">{NO_CLAIM_NOTE}</p>

      <div className={styles.toneDial}>
        <label htmlFor="tone-hz">Pitch (Hz)
          <input id="tone-hz" type="number" inputMode="decimal" min={TONE_MIN_HZ} max={TONE_MAX_HZ} step={0.01} value={dial.hz}
            onChange={e => change({ hz: clampToneHz(e.target.value) })} />
        </label>
        <input type="range" aria-label="Pitch, fine control" min={TONE_MIN_HZ} max={TONE_MAX_HZ} step={0.5} value={dial.hz}
          onChange={e => change({ hz: clampToneHz(e.target.value) })} />
      </div>

      <div className={styles.focusInlineChoices} role="radiogroup" aria-label="Pulse">
        {PULSE_MODES.map(mode => (
          <button key={mode.id} type="button" role="radio" aria-checked={dial.pulseMode === mode.id} data-tone-pulse={mode.id}
            className={dial.pulseMode === mode.id ? styles.focusChoiceActive : styles.focusChoice}
            onClick={() => change({ pulseMode: mode.id as PulseMode }, true)}>{mode.label}</button>
        ))}
      </div>
      <p className={styles.focusExplanation}>{PULSE_MODES.find(m => m.id === dial.pulseMode)?.line}</p>
      {dial.pulseMode !== 'none' && (
        <div className={styles.toneDial}>
          <label htmlFor="tone-pulse">Pulse rate (Hz)
            <input id="tone-pulse" type="number" inputMode="decimal" min={PULSE_MIN_HZ} max={PULSE_MAX_HZ} step={0.01} value={dial.pulseHz}
              onChange={e => change({ pulseHz: clampPulseHz(e.target.value) })} />
          </label>
          <input type="range" aria-label="Pulse rate, fine control" min={PULSE_MIN_HZ} max={PULSE_MAX_HZ} step={0.5} value={dial.pulseHz}
            onChange={e => change({ pulseHz: clampPulseHz(e.target.value) })} />
        </div>
      )}

      <label className={styles.toneBed} htmlFor="tone-bed">Underneath
        <select id="tone-bed" value={dial.bed} onChange={e => change({ bed: e.target.value as ToneBed }, true)}>
          {TONE_BEDS.map(bed => <option key={bed.id} value={bed.id}>{bed.label}</option>)}
        </select>
      </label>

      <div className={styles.toneNotes} data-tone-notes="true">
        {notes.map(note => <p key={note} className={styles.muted}>{note}</p>)}
      </div>

      <button type="button" className={styles.play} data-tone-play="true" onClick={() => void play()} disabled={!transport}>
        {live ? '▶  Play again with this dial' : '▶  Play'}
      </button>
      {transport && live && <button type="button" className={styles.ghost} data-tone-stop="true" onClick={() => transport.stopMusic()}>Stop</button>}
      {message && <p className={styles.focusStatus} role="status" aria-live="polite">{message}</p>}
      <p className={styles.toneProvenance} data-tone-provenance="true">
        {preset ? preset.provenance : 'Your own setting. It comes from you; no claim is made about it.'}
      </p>

      <h3 className={styles.toneHeading}>Starting points, with where they come from</h3>
      {GROUPS.map(group => (
        <div key={group} className={styles.toneGroup}>
          <h4>{group}</h4>
          <div className={styles.focusInlineChoices}>
            {TONE_PRESETS.filter(p => p.group === group).map(p => (
              <button key={p.id} type="button" data-tone-preset={p.id} aria-pressed={presetId === p.id}
                className={presetId === p.id ? styles.focusChoiceActive : styles.focusChoice}
                onClick={() => { setDial(applyPreset(p, dial.bed)); setPresetId(p.id); }}>{p.label}</button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
