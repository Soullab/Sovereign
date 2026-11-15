'use client';

/**
 * Ask MAIA — bring one Atlas symbol, or one aspect of it, into conversation.
 *
 * Follows DiscussWithMaia (components/reflections/DiscussWithMaia.tsx):
 *  1. Nothing is interpreted in advance. The member chooses a question.
 *  2. The member reads and can edit exactly what travels before it is sent.
 *  3. Where the presence layer can host MAIA here, the conversation opens over
 *     this page. Otherwise the existing seed channel carries the message to
 *     /maia, with the way back to this entry.
 *  4. No new persistence, no URL parameters: the seed lives in localStorage
 *     for at most ten minutes and is consumed once.
 *
 * Only public Atlas text travels (see lib/oracle/atlas/askMaia.ts). Nothing
 * from a member's reading is included.
 */
import { useId, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { seedMaiaPrompt } from '@/lib/maia/seedPrompt';
import { useMaiaPresence } from '@/components/maia/presence/MaiaPresence';
import {
  ASK_MAIA_OPENINGS,
  buildAskMaiaContext,
  withOpening,
  type AskMaiaTopic,
} from '@/lib/oracle/atlas/askMaia';
import styles from '@/app/oracle/atlas/atlas.module.css';

export interface AskMaiaProps extends AskMaiaTopic {
  /** Visible label of the toggle, e.g. "Ask MAIA about this layer". */
  label?: string;
  /** Larger toggle for the whole-symbol ask in the hero. */
  prominent?: boolean;
}

export function AskMaia({ label, prominent, ...topic }: AskMaiaProps) {
  const router = useRouter();
  const pathname = usePathname();
  const presence = useMaiaPresence();
  const panelId = useId();
  const context = useMemo(
    () => buildAskMaiaContext(topic),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic.tradition, topic.subject, topic.aspect, topic.evidence, topic.body],
  );
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [message, setMessage] = useState(context);

  const toggleText = label ?? (topic.aspect ? `Ask MAIA about ${topic.aspect.toLowerCase()}` : `Ask MAIA about ${topic.subject}`);

  const send = () => {
    const prompt = message.trim();
    if (!prompt) return;
    if (presence?.canHost) {
      presence.openMaiaWith(prompt);
      return;
    }
    seedMaiaPrompt({
      prompt,
      source: 'divination:atlas',
      sourceLabel: topic.aspect ? `${topic.subject} · ${topic.aspect}` : topic.subject,
      returnTo: pathname ?? '/oracle/atlas',
    });
    router.push('/maia');
  };

  return (
    <div className={styles.ask} data-prominent={prominent ? 'true' : undefined}>
      <button
        type="button"
        className={styles.askToggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true" className={styles.askMark}>✦</span>
        {toggleText}
      </button>

      {open && (
        <div id={panelId} className={styles.askPanel}>
          <p className={styles.askLead}>Choose a question, or write your own. MAIA has not read anything into this.</p>
          <div className={styles.askOpenings} role="group" aria-label="Questions you could ask">
            {ASK_MAIA_OPENINGS.map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={opening === o.key}
                className={styles.askChip}
                onClick={() => {
                  setOpening(o.key);
                  setMessage(withOpening(context, o.line));
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <label className={styles.askLabel} htmlFor={`${panelId}-text`}>
            What MAIA will receive
          </label>
          <textarea
            id={`${panelId}-text`}
            className={styles.askText}
            value={message}
            rows={6}
            onChange={(e) => {
              setMessage(e.target.value);
              setOpening(null);
            }}
          />
          <p className={styles.askNote}>
            Only what you see here travels. Edit or clear it first if you like. If you are signed
            out, you will be asked to sign in, and the message waits for ten minutes.
          </p>
          <button type="button" className={styles.askSend} onClick={send} disabled={!message.trim()}>
            Ask MAIA →
          </button>
        </div>
      )}
    </div>
  );
}
