'use client';

import { useEffect, useRef, useState } from 'react';
import { usePersistentListening } from '@/components/listening/PersistentListeningProvider';
import {
  EXPORT_MINUTES, exportFileName, exportVariants, renderSoundscapeWav, type ExportMinutes, type ExportVariant,
} from '@/lib/listening/soundscapeExport';
import styles from './listen.module.css';

// "Save as an audio file" (#1979; founder 2026-11-21: "Yes, options 1+2"). Renders Your soundscape, exactly as set
// now, to a WAV file for a sound player or memory card, through the same engine, faster than real time. Nothing
// plays and nothing is uploaded: the file is made on this device and saved by the member.
type Want = 'both' | 'headphones' | 'speaker';
type Saved = { name: string; url: string; bytes: number; clipped: number; recorded: string[] };

const gb = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${Math.round(bytes / 1e6)} MB`);
const WAV_BYTES_PER_MIN = 44100 * 2 * 2 * 60;

export default function FocusSoundExport() {
  const transport = usePersistentListening();
  const [name, setName] = useState('Your soundscape');
  const [minutes, setMinutes] = useState<ExportMinutes>(120);
  const [want, setWant] = useState<Want>('both');
  const [progress, setProgress] = useState('');
  const [saved, setSaved] = useState<Saved[]>([]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => { abort.current?.abort(); urls.current.forEach(u => URL.revokeObjectURL(u)); }, []);

  const settings = transport?.focusSoundExport() ?? null;
  if (!transport || !settings) return null;
  const variants = exportVariants(settings.spec);
  const binaural = variants.length > 1;
  const chosen: ExportVariant[] = !binaural ? variants : variants.filter(v => want === 'both' || v.device === want);
  const pulseHz = settings.spec.toneLayer?.pulseHz;

  const save = async () => {
    if (busy) return;
    urls.current.forEach(u => URL.revokeObjectURL(u)); urls.current = []; setSaved([]);
    const controller = new AbortController(); abort.current = controller; setBusy(true);
    const made: Saved[] = [];
    try {
      for (let i = 0; i < chosen.length; i++) {
        const variant = chosen[i];
        const result = await renderSoundscapeWav({ ...settings, spec: variant.spec }, minutes * 60, {
          loadRecorded: transport.exportRecordingLoader, signal: controller.signal,
          onProgress: p => setProgress(`Making file ${i + 1} of ${chosen.length}: ${Math.round((p.done / p.total) * 100)}%`),
        });
        const url = URL.createObjectURL(result.blob); urls.current.push(url);
        made.push({ name: exportFileName(name, minutes, variant), url, bytes: result.blob.size, clipped: result.clippedSamples, recorded: result.recordedLayers });
        setSaved([...made]);
      }
      setProgress(made.length === 1 ? 'Your file is ready.' : 'Your files are ready.');
    } catch (error) {
      setProgress(error instanceof DOMException && error.name === 'AbortError'
        ? 'Stopped. No file was made.' : 'The file could not be made on this device. A shorter length may work.');
    } finally {
      setBusy(false); abort.current = null;
    }
  };

  return (
    <div className={styles.focusToneLayer} data-focus-export="true">
      <h4>Save as an audio file</h4>
      <p className={styles.focusExplanation}>
        Makes a WAV file of Your soundscape exactly as it is set now (your choices, Level, Overtones, Nature recordings,
        Weave and Tone) for a sound player or a memory card. It is made on this device, faster than real time; nothing plays.
      </p>
      <label className={styles.focusSoundLevel}>
        <span>File name</span>
        <input type="text" value={name} maxLength={80} aria-label="File name" data-export-name="true"
          onChange={event => setName(event.target.value)} disabled={busy} />
        <output />
      </label>
      <div className={styles.focusInlineChoices} role="radiogroup" aria-label="Length">
        {EXPORT_MINUTES.map(m => (
          <button key={m} type="button" role="radio" aria-checked={minutes === m} data-export-minutes={m} disabled={busy}
            className={minutes === m ? styles.focusChoiceActive : styles.focusChoice} onClick={() => setMinutes(m)}>
            {m < 60 ? `${m} min` : m === 90 ? '1½ hours' : `${m / 60} hour${m === 60 ? '' : 's'}`}
          </button>
        ))}
      </div>
      {binaural ? (
        <>
          <div className={styles.focusInlineChoices} role="radiogroup" aria-label="Device">
            {([['both', 'Both (two files)'], ['headphones', 'Headphones'], ['speaker', 'Speaker']] as const).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={want === id} data-export-device={id} disabled={busy}
                className={want === id ? styles.focusChoiceActive : styles.focusChoice} onClick={() => setWant(id)}>{label}</button>
            ))}
          </div>
          <p className={styles.focusExplanation} data-export-device-line="true">
            Headphones keeps your binaural pulse, which needs each ear to hear its own tone. Speaker carries the same
            {pulseHz ? ` ${pulseHz} Hz` : ''} rate as an isochronic pulse instead, which any speaker plays.
          </p>
        </>
      ) : (
        <p className={styles.focusExplanation} data-export-device-line="true">This sound has no binaural pulse, so one file plays the same on headphones and speakers.</p>
      )}
      <p className={styles.focusExplanation}>
        About {gb(minutes * WAV_BYTES_PER_MIN)} per file (WAV, 44.1 kHz, 16-bit stereo). It fades in and out over a few
        seconds, so it starts gently and repeats softly on a player.
      </p>
      {busy
        ? <button type="button" className={styles.play} data-export-cancel="true" onClick={() => abort.current?.abort()}>Stop making the file</button>
        : <button type="button" className={styles.play} data-export-save="true" onClick={() => void save()}>
            {chosen.length > 1 ? 'Make both files' : 'Make the file'}
          </button>}
      {progress && <p className={styles.focusStatus} role="status" aria-live="polite" data-export-progress="true">{progress}</p>}
      {saved.map(file => (
        <p key={file.url} className={styles.focusExplanation} data-export-file="true">
          <a href={file.url} download={file.name}>Save “{file.name}”</a> ({gb(file.bytes)})
          {file.clipped > 0 ? ' · Some peaks were too loud and were clipped; lower Level and make it again.' : ''}
          {file.recorded.length > 0 ? ` · Real recordings in it: ${file.recorded.join(', ')}.` : ' · Synthesized sound only.'}
        </p>
      ))}
      <p className={styles.focusExplanation} data-export-rights="true">
        For your own listening. The nature recordings in these files are not yet cleared for sharing, so please keep the
        files to yourself.
      </p>
    </div>
  );
}
