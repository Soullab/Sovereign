'use client';

import { useEffect, useRef, useState } from 'react';
import { usePersistentListening } from '@/components/listening/PersistentListeningProvider';
import {
  EXPORT_MINUTES, exportFileName, exportVariants, renderSoundscapeWav, type ExportMinutes, type ExportResult, type ExportVariant,
} from '@/lib/listening/soundscapeExport';
import styles from './listen.module.css';

// "Save as an audio file" (#1979; founder 2026-11-21: "Yes, options 1+2"; then "can we offer the option to download
// files to different options like Drive and other options the member might have" → "Yes, build both").
// Renders Your soundscape, exactly as set now, to a WAV file through the same engine, faster than real time.
// WHERE it goes is the member's device's own business: Soullab connects to no account and uploads nothing.
//   · "Save to…" (Chrome, Edge): the browser's own Save window. Any place the computer can see: Google Drive,
//     iCloud Drive, Dropbox or OneDrive folders, an SSD, the memory card itself. The file streams straight there.
//   · Elsewhere: the file is made here, then saved (the browser's download) or shared (the device's share sheet:
//     Files, Drive, AirDrop…) by the member's own click.
type Want = 'both' | 'headphones' | 'speaker';
type Saved = { name: string; url: string | null; blob: Blob | null; bytes: number; clipped: number; recorded: string[]; placed: boolean };
type SavePicker = (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) =>
  Promise<{ createWritable(): Promise<{ write(data: ArrayBuffer): Promise<void>; close(): Promise<void>; abort(): Promise<void> }> }>;

const gb = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${Math.round(bytes / 1e6)} MB`);
const WAV_BYTES_PER_MIN = 44100 * 2 * 2 * 60;
const deviceWord = (v: ExportVariant) => (v.device === 'headphones' ? 'headphones file' : v.device === 'speaker' ? 'speaker file' : 'file');

export default function FocusSoundExport() {
  const transport = usePersistentListening();
  const [name, setName] = useState('Your soundscape');
  const [minutes, setMinutes] = useState<ExportMinutes>(120);
  const [want, setWant] = useState<Want>('both');
  const [progress, setProgress] = useState('');
  const [saved, setSaved] = useState<Saved[]>([]);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<SavePicker | null>(null);
  const [canShare, setCanShare] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => {
    // What this browser can do, decided after load (never during server rendering).
    const w = window as Window & { showSaveFilePicker?: SavePicker };
    if (typeof w.showSaveFilePicker === 'function') setPicker(() => w.showSaveFilePicker!.bind(window));
    try { setCanShare(!!navigator.canShare?.({ files: [new File([''], 'test.wav', { type: 'audio/wav' })] })); } catch { setCanShare(false); }
    return () => { abort.current?.abort(); urls.current.forEach(u => URL.revokeObjectURL(u)); };
  }, []);

  const settings = transport?.focusSoundExport() ?? null;
  if (!transport || !settings) return null;
  const variants = exportVariants(settings.spec);
  const binaural = variants.length > 1;
  const chosen: ExportVariant[] = !binaural ? variants : variants.filter(v => want === 'both' || v.device === want);
  const pulseHz = settings.spec.toneLayer?.pulseHz;

  const render = (variant: ExportVariant, label: string, signal: AbortSignal, sink?: { write(c: ArrayBuffer): Promise<void> }): Promise<ExportResult> =>
    renderSoundscapeWav({ ...settings, spec: variant.spec }, minutes * 60, {
      loadRecorded: transport.exportRecordingLoader, signal, sink,
      onProgress: p => setProgress(`${label}: ${Math.round((p.done / p.total) * 100)}%`),
    });
  const failed = (error: unknown, nothing: string) => setProgress(error instanceof DOMException && error.name === 'AbortError'
    ? nothing : 'The file could not be made on this device. A shorter length may work.');

  // "Save to…": one file per click, because the Save window opens only from the member's own click.
  const saveTo = async (variant: ExportVariant) => {
    if (busy || !picker) return;
    const fileName = exportFileName(name, minutes, variant);
    let writable: Awaited<ReturnType<Awaited<ReturnType<SavePicker>>['createWritable']>> | null = null;
    const controller = new AbortController(); abort.current = controller;
    try {
      const handle = await picker({ suggestedName: fileName, types: [{ description: 'WAV audio', accept: { 'audio/wav': ['.wav'] } }] });
      writable = await handle.createWritable();
      setBusy(true);
      const target = writable;
      const result = await render(variant, `Saving the ${deviceWord(variant)}`, controller.signal, { write: chunk => target.write(chunk) });
      await target.close(); writable = null;
      setSaved(list => [...list.filter(f => f.name !== fileName), { name: fileName, url: null, blob: null, bytes: result.bytes, clipped: result.clippedSamples, recorded: result.recordedLayers, placed: true }]);
      setProgress(`Saved the ${deviceWord(variant)} where you chose.`);
    } catch (error) {
      await writable?.abort().catch(() => undefined); // nothing half-written is left behind
      failed(error, 'Nothing was saved.');
    } finally {
      setBusy(false); abort.current = null;
    }
  };

  // Elsewhere: make the file(s) here, then the member saves or shares each one.
  const make = async () => {
    if (busy) return;
    urls.current.forEach(u => URL.revokeObjectURL(u)); urls.current = []; setSaved([]);
    const controller = new AbortController(); abort.current = controller; setBusy(true);
    const made: Saved[] = [];
    try {
      for (let i = 0; i < chosen.length; i++) {
        const result = await render(chosen[i], `Making file ${i + 1} of ${chosen.length}`, controller.signal);
        const url = URL.createObjectURL(result.blob!); urls.current.push(url);
        made.push({ name: exportFileName(name, minutes, chosen[i]), url, blob: result.blob, bytes: result.bytes, clipped: result.clippedSamples, recorded: result.recordedLayers, placed: false });
        setSaved([...made]);
      }
      setProgress(made.length === 1 ? 'Your file is ready to save or share.' : 'Your files are ready to save or share.');
    } catch (error) {
      failed(error, 'Stopped. No file was made.');
    } finally {
      setBusy(false); abort.current = null;
    }
  };

  const share = async (file: Saved) => {
    if (!file.blob) return;
    const f = new File([file.blob], file.name, { type: 'audio/wav' });
    if (!navigator.canShare?.({ files: [f] })) { setProgress('This device cannot share a file this large. Use Save, or a shorter length.'); return; }
    try { await navigator.share({ files: [f], title: file.name }); } catch { /* the member closed the share sheet */ }
  };

  return (
    <div className={styles.focusToneLayer} data-focus-export="true" data-export-mode={picker ? 'save-to' : 'make'}>
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
      {picker ? (
        <>
          <p className={styles.focusExplanation} data-export-where="save-to">
            You choose where each file goes: a folder on this computer, Google Drive, iCloud Drive, Dropbox or OneDrive (if
            their folders are on this computer), an SSD, or the memory card itself. Soullab never sees the file.
          </p>
          {busy
            ? <button type="button" className={styles.play} data-export-cancel="true" onClick={() => abort.current?.abort()}>Stop saving</button>
            : chosen.map(v => (
              <button key={v.device} type="button" className={styles.play} data-export-save-to={v.device} onClick={() => void saveTo(v)}>
                {`Save the ${deviceWord(v)} to…`}
              </button>
            ))}
        </>
      ) : (
        <>
          <p className={styles.focusExplanation} data-export-where="make">
            The file is made here first. Then Save puts it where this browser keeps downloads
            {canShare ? ', and Share sends it with this device’s share sheet (Files, Google Drive, AirDrop and others). On a phone, 30 minutes or 1 hour is the safest length to share' : ''}.
            Soullab never sees the file.
          </p>
          {busy
            ? <button type="button" className={styles.play} data-export-cancel="true" onClick={() => abort.current?.abort()}>Stop making the file</button>
            : <button type="button" className={styles.play} data-export-save="true" onClick={() => void make()}>
                {chosen.length > 1 ? 'Make both files' : 'Make the file'}
              </button>}
        </>
      )}
      {progress && <p className={styles.focusStatus} role="status" aria-live="polite" data-export-progress="true">{progress}</p>}
      {saved.map(file => (
        <p key={file.name} className={styles.focusExplanation} data-export-file="true">
          {file.placed ? <>Saved “{file.name}”</> : <a href={file.url ?? undefined} download={file.name}>Save “{file.name}”</a>} ({gb(file.bytes)})
          {!file.placed && canShare && (
            <> · <button type="button" className={styles.focusChoice} data-export-share="true" onClick={() => void share(file)}>Share…</button></>
          )}
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
