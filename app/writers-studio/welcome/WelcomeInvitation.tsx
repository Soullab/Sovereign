'use client';

import { useState } from 'react';
import { useMemberIdentity } from '../useMemberIdentity';
import styles from './welcome.module.css';

type Path = 'return' | 'new' | 'both';

const PATHS: { id: Path; title: string; hint: string }[] = [
  { id: 'return', title: 'Return to a book I have written', hint: 'See it with fresh eyes, then decide what to refine' },
  { id: 'new', title: 'Begin a new work', hint: 'A clear page, with someone to think alongside' },
  { id: 'both', title: 'Both, in their own spaces', hint: 'Two separate Works, so they never blur together' },
];

const JOURNEYS: Record<Path, { heading: string; steps: [string, string][] }> = {
  return: {
    heading: 'Returning to your book',
    steps: [
      ['Bring it in', "Upload the file you have: Word, PDF or plain text. You'll see the text and the chapter breaks before anything is saved, and you can adjust them. A Word file usually comes in most cleanly."],
      ['Meet it again, one chapter at a time', 'Open a chapter and ask MAIA anything. Under every answer, a line tells you exactly what MAIA read, so you always know what it is responding to.'],
      ['See the shape of it', 'In Develop, MAIA can read for structure, continuity, how a reader meets the story, voice, and the themes that keep returning, with the passages that show it.'],
      ['Explore what’s possible', "In Review, MAIA brings you what she noticed. You can discuss any of it with her, and your book doesn't change while you talk."],
      ['Refine what calls to you', 'Choose the chapters and directions that excite you, and work through them at your own pace.'],
    ],
  },
  new: {
    heading: 'Beginning a new work',
    steps: [
      ['Start a Work of its own', 'Give it a working title, or none at all. It lives apart from anything else you have written.'],
      ['Write, and ask when you want to', "MAIA waits until you ask. When you do, she responds to what's on the page, not to a formula."],
      ['Let it take shape', "As chapters gather, Develop shows you the structure you're building and what keeps returning."],
    ],
  },
  both: {
    heading: 'Two books, two spaces',
    steps: [
      ['Two Works', 'Your earlier book and your new work sit side by side in the Studio and never mix.'],
      ['Start with whichever feels alive today', "Some days, revisiting the old book will spark the new one. Some days you'll want a clean page. Either is a good day's work."],
      ['MAIA reads only the Work you’re in', 'And only what you let her read. You can allow her to read your saved chapters, or stop that, at any time.'],
    ],
  },
};

const FIRST_QUESTIONS = [
  'What is this chapter really trying to do?',
  'Where might a reader lose the thread here?',
  'What are three directions this book could grow in?',
  'Which habits in my sentences might I want to clean up?',
];

const GOOD_TO_KNOW: [string, string][] = [
  ['Will MAIA fix the grammar and typos?', "Not automatically. MAIA can point out patterns and talk through any sentence you're unsure of, but the corrections are yours to make. For a full line-by-line cleanup, a human copyeditor is still the right partner, and MAIA can help you decide what you want before that stage."],
  ['Does MAIA read the whole book at once?', "She reads a good portion at a time (roughly a few chapters' worth) and tells you exactly what she read and what she left out. That's why this journey goes chapter by chapter, which is also how most revisions work best."],
  ['Who sees my writing?', "Your book is stored on Soullab's own servers. When you ask MAIA something, the passage she reads goes to the AI model that powers her (Anthropic's Claude) to form her answer. She reads only the Work you're in, and only what you allow, and every answer tells you what she read."],
];

/** First word of the name the writer gave us, for a warm greeting. Never invented. */
export function greetingName(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

function CopyButton({ text }: { text: string }) {
  const [label, setLabel] = useState('Copy');
  return (
    <button
      type="button"
      className={styles.copy}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setLabel('Copied'); }
        catch { setLabel('Select to copy'); }
        setTimeout(() => setLabel('Copy'), 1800);
      }}
    >{label}</button>
  );
}

export function WelcomeInvitation() {
  const identity = useMemberIdentity();
  const [path, setPath] = useState<Path | null>(null);
  const first = identity.phase === 'ready' ? greetingName(identity.name) : null;
  const signedIn = identity.phase === 'ready';
  const journey = path ? JOURNEYS[path] : null;

  return (
    <main className={styles.page} data-welcome-invitation>
      <div className={styles.mark}>Soullab · Writer&apos;s Studio</div>
      <h1 className={styles.h1} data-welcome-greeting>
        {first ? `${first}, your writing has more in it than you remember.` : 'Your writing has more in it than you remember.'}
      </h1>
      <p className={styles.lead}>
        You&apos;re invited to spend some time with your work alongside MAIA, a companion that reads with you, notices
        what&apos;s there, and helps you think about what it could become.
      </p>
      <p>Nothing changes unless you change it. MAIA offers observations, possibilities and questions. The decisions, and the words, stay yours.</p>

      <section className={styles.section} aria-labelledby="wl-where">
        <h2 id="wl-where" className={styles.h2}>Where would you like to begin?</h2>
        <p>Choose one. You can always do the other later.</p>
        <div className={styles.paths} role="group" aria-label="Where to begin">
          {PATHS.map((p) => (
            <button key={p.id} type="button" className={styles.path} aria-pressed={path === p.id}
              data-welcome-path={p.id} onClick={() => {
                setPath(p.id);
                // Bring the chosen path into view; a new writer should see what opened, not hunt for it.
                requestAnimationFrame(() => document.querySelector('[data-welcome-journey]')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
              }}>
              <strong>{p.title}</strong><span>{p.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {journey && (
        <section className={styles.section} aria-live="polite" data-welcome-journey={path}>
          <h2 className={styles.h2}>{journey.heading}</h2>
          <ol className={styles.steps}>
            {journey.steps.map(([h, b]) => <li key={h}><h3>{h}</h3><p>{b}</p></li>)}
          </ol>
        </section>
      )}

      <section className={styles.section} aria-labelledby="wl-first">
        <h2 id="wl-first" className={styles.h2}>A few first questions</h2>
        <p>If you&apos;re not sure what to ask, try one of these.</p>
        <div className={styles.qs}>
          {FIRST_QUESTIONS.map((q) => (
            <div key={q} className={styles.q}><em>{q}</em><CopyButton text={q} /></div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="wl-know">
        <h2 id="wl-know" className={styles.h2}>Good to know</h2>
        {GOOD_TO_KNOW.map(([q, a]) => (
          <details key={q} className={styles.details}><summary>{q}</summary><p>{a}</p></details>
        ))}
      </section>

      <div className={styles.cta}>
        {signedIn || identity.phase === 'loading' ? (
          <a className={styles.btn} href="/writers-studio" data-welcome-cta="studio">Open Writer&apos;s Studio</a>
        ) : (
          <>
            <a className={styles.btn} href="/signin" data-welcome-cta="signin">Sign in to begin</a>
            <a className={styles.link} href="/begin" data-welcome-cta="begin">New to Soullab? Begin your journey</a>
          </>
        )}
      </div>

      <footer className={styles.footer}>
        Questions, or would you like someone with you for your first session?{' '}
        <a className={styles.link} href="mailto:kelly@soullab.life">Write to Kelly</a>.
      </footer>
    </main>
  );
}
