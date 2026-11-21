'use client';

import { useState } from 'react';
import { usePersistentListening } from '@/components/listening/PersistentListeningProvider';
import { FOCUS_SOUND_OPTIONS, focusSoundLabel } from '@/lib/listening/focusSoundChoices';
import styles from './listen.module.css';

// Sound for a Focus session. Deliberately OUTSIDE FocusFieldDesk: the Focus session itself has no media
// authority (LISTEN-48/49). Choosing here starts nothing; Play is a separate member action (here, or in the
// player bar while a session runs) and goes through the one persistent player like every other sound.
// Says plainly which layers are real recordings and which have none (and so are synthesized sound only).
function recordedLayersLine(layers: Partial<Record<string, 'loading' | 'recorded' | 'missing'>>): string {
  const ids = Object.keys(layers);
  if (ids.length === 0) return 'Press Play to hear which nature layers are real recordings.';
  const of = (state: string) => ids.filter(id => layers[id] === state);
  const parts = [
    of('recorded').length ? `Real recordings: ${of('recorded').join(', ')}` : '',
    of('missing').length ? `No recording yet (synthesized only): ${of('missing').join(', ')}` : '',
    of('loading').length ? `Loading: ${of('loading').join(', ')}` : '',
  ].filter(Boolean);
  return `${parts.join(' · ')}.`;
}

export default function FocusSoundPicker() {
  const transport = usePersistentListening();
  const [message, setMessage] = useState('');
  const soundId = transport?.focusSoundChoice ?? 'none';
  const option = FOCUS_SOUND_OPTIONS.find(item => item.id === soundId) ?? FOCUS_SOUND_OPTIONS[0];
  // As the player bar decides it: a generated sound's level is always Soullab's to set; recorded media on a
  // phone follows the device's own volume buttons.
  const levelAdjustable = !!transport && (transport.volumeAdjustable || transport.snapshot.kind === 'sketch');
  // The generated choices that carry overtones (Open Ground is a recording; Tone Lab never has them).
  const hasOvertones = soundId === 'soundscape' || soundId === 'deep-focus' || soundId === 'creative-flow';
  const sessionLive =transport?.focusSession?.status === 'running' || transport?.focusSession?.status === 'paused';

  const play = async () => {
    if (!transport || soundId === 'none') return;
    const started = await transport.playFocusSound();
    setMessage(started
      ? 'Sound is playing. Pause and Stop are in the player below; the focus timer is separate.'
      : 'Sound did not start. Another Soullab audio experience may be active, or the media is unavailable.');
  };

  return (
    <section id="focus-sound" className={styles.focusSound} aria-labelledby="focus-sound-title" data-focus-sound-picker="true">
      <h3 id="focus-sound-title">Sound for this session</h3>
      <div className={styles.focusInlineChoices} role="radiogroup" aria-label="Sound for this session">
        {FOCUS_SOUND_OPTIONS.map(item => (
          <button key={item.id} type="button" role="radio" aria-checked={soundId === item.id}
            data-focus-sound={item.id}
            className={soundId === item.id ? styles.focusChoiceActive : styles.focusChoice}
            onClick={() => { transport?.setFocusSoundChoice(item.id); setMessage(''); }}>{item.label}</button>
        ))}
      </div>
      <p className={styles.focusExplanation}>
        {option.line}. Nothing plays until you press Play{sessionLive ? ' — here or in the player bar below' : ''}.
      </p>
      {soundId !== 'none' && (
        <button type="button" className={styles.play} data-focus-play-sound="true"
          onClick={() => void play()} disabled={!transport}>
          {`▶  Play ${focusSoundLabel(soundId)}`}{sessionLive ? '' : ' (no timer running)'}
        </button>
      )}
      {soundId !== 'none' && transport && (levelAdjustable ? (
        // The ONE player's level, the same value as Level in the player bar (founder, 2026-11-19, #1979).
        <label className={styles.focusSoundLevel} data-focus-sound-level="adjustable">
          <span>Level</span>
          <input aria-label="Level for this session's sound" type="range" min="0" max="100" step="1"
            value={transport.volume} aria-valuetext={`${Math.round(transport.volume)}%`}
            onChange={event => transport.setVolume(Number(event.target.value))} />
          <output>{Math.round(transport.volume)}%</output>
        </label>
      ) : (
        <p className={styles.focusExplanation} data-focus-sound-level="device">Level: use this device’s volume buttons.</p>
      ))}
      {hasOvertones && transport && (
        // The member's Overtones setting (founder, 2026-11-21, #1979): on or off, and how much. Changes the sound now.
        <div className={styles.focusSoundLevel} data-focus-overtones={transport.overtones.on ? 'on' : 'off'}>
          <label className={styles.focusOvertoneToggle}>
            <input type="checkbox" checked={transport.overtones.on} data-focus-overtones-toggle="true"
              onChange={event => transport.setOvertones({ ...transport.overtones, on: event.target.checked })} />
            <span>Overtones</span>
          </label>
          <input aria-label="Overtone amount" type="range" min="0" max="100" step="1" data-focus-overtones-amount="true"
            value={transport.overtones.amount} disabled={!transport.overtones.on}
            aria-valuetext={transport.overtones.on ? `${transport.overtones.amount}%` : 'Off'}
            onChange={event => transport.setOvertones({ on: true, amount: Number(event.target.value) })} />
          <output>{transport.overtones.on ? `${transport.overtones.amount}%` : 'Off'}</output>
        </div>
      )}
      {soundId === 'soundscape' && transport?.focusDraft?.world === 'nature' && (
        // N1 (#1979): how loud the REAL recordings are against the synthesized sound; 0% is synthesis alone.
        <>
          <label className={styles.focusSoundLevel} data-focus-nature-recordings="true">
            <span>Nature recordings</span>
            <input aria-label="Nature recordings amount" type="range" min="0" max="100" step="1"
              value={transport.natureRecordings}
              aria-valuetext={transport.natureRecordings === 0 ? 'Off: synthesis only' : `${transport.natureRecordings}%`}
              onChange={event => transport.setNatureRecordings(Number(event.target.value))} />
            <output>{transport.natureRecordings === 0 ? 'Off' : `${transport.natureRecordings}%`}</output>
          </label>
          <p className={styles.focusExplanation} data-focus-recorded-layers="true">{recordedLayersLine(transport.recordedLayers)}</p>
        </>
      )}
      {message && <p className={styles.focusStatus} role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
