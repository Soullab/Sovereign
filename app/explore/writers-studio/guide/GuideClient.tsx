'use client';
/**
 * The guide itself: one large step at a time, plain words, keyboard arrows, and at every step a place to talk with MAIA about it.
 * ⛔ No fetch, no storage, no analytics. The current step lives in the URL hash only.
 * ⛔ "Talk with MAIA about this" here shows the question; MAIA herself is in the Studio, where the same step's question is placed in
 *    the conversation for the writer to send. This page never sends anything.
 */
import { useCallback, useEffect, useState } from 'react';
import { STUDIO_GUIDES, guideById, parseGuideHash, type GuideId } from '@/lib/writersStudio/studioGuides';
import styles from './guide.module.css';

type View = { guide: GuideId; step: number } | null;

export default function GuideClient() {
  const [view, setView] = useState<View>(null);
  const [talkOpen, setTalkOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sync = () => { setView(parseGuideHash(window.location.hash)); setTalkOpen(false); setCopied(false); };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const go = useCallback((next: View) => {
    window.location.hash = next ? `${next.guide}-${next.step}` : '';
    setView(next);
    setTalkOpen(false);
    setCopied(false);
  }, []);

  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea')) return;
      const n = guideById(view.guide).steps.length;
      if (e.key === 'ArrowRight' && view.step < n) go({ ...view, step: view.step + 1 });
      if (e.key === 'ArrowLeft' && view.step > 1) go({ ...view, step: view.step - 1 });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, go]);

  if (!view) {
    return (
      <main className={styles.page}>
        <h1 className={styles.h1}>Writer’s Studio guides</h1>
        <p className={styles.lede}>Step by step, with the Studio’s own buttons named exactly. Keep this open on your phone while you write on your computer.</p>
        <div className={styles.doors}>
          {STUDIO_GUIDES.map((g) => (
            <button key={g.id} type="button" className={styles.door} onClick={() => go({ guide: g.id, step: 1 })}>
              <span className={styles.doorTitle}>{g.title}</span>
              <span>{g.intro}</span>
              <span className={styles.go}>{g.steps.length} steps →</span>
            </button>
          ))}
        </div>
        <ul className={styles.promise}>
          <li>MAIA reads only what you show her or allow her to read.</li>
          <li>She suggests. You press the buttons, and nothing in your writing changes unless you choose it.</li>
          <li>In Sanctuary, nothing from the session is saved.</li>
        </ul>
      </main>
    );
  }

  const guide = guideById(view.guide);
  const step = guide.steps[view.step - 1];
  const last = view.step === guide.steps.length;
  const copy = async () => {
    try { await navigator.clipboard.writeText(step.talk); setCopied(true); } catch { setCopied(false); }
  };

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <button type="button" className={styles.back} onClick={() => go(null)}>← All guides</button>
        <span className={styles.count}>{guide.title} · step {view.step} of {guide.steps.length}</span>
      </div>
      <h1 className={styles.h2}>{step.title}</h1>
      <ol className={styles.do}>{step.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      <div className={styles.tip}><b>{step.tip.label}</b>{step.tip.text}</div>

      <section className={styles.talk} aria-label="Talk with MAIA about this">
        <button type="button" className={styles.talkButton} aria-expanded={talkOpen} onClick={() => setTalkOpen((o) => !o)}>
          Talk with MAIA about this
        </button>
        {talkOpen ? (
          <div className={styles.talkBody}>
            <p className={styles.question}>“{step.talk}”</p>
            <p>MAIA is in the Studio. On your computer, press “What do I do next?” in her column, then “Talk with MAIA about this step”. This question is placed there for you to change or send.</p>
            <button type="button" className={styles.quiet} onClick={copy}>{copied ? 'Copied' : 'Copy the question'}</button>
          </div>
        ) : null}
      </section>

      <nav className={styles.nav} aria-label="Steps">
        <button type="button" disabled={view.step === 1} onClick={() => go({ ...view, step: view.step - 1 })}>← Back</button>
        {last
          ? <button type="button" className={styles.next} onClick={() => go(null)}>Finish</button>
          : <button type="button" className={styles.next} onClick={() => go({ ...view, step: view.step + 1 })}>Next →</button>}
      </nav>
    </main>
  );
}
