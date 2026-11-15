/**
 * Ask MAIA from the Divination Atlas — the message a member may choose to send.
 *
 * Constraints (canon, not preference):
 *  - The member sees and can edit the whole message before anything travels.
 *    This module only builds the draft; it sends nothing and stores nothing.
 *  - Only public Atlas material travels (the symbol, the aspect, its evidence
 *    label and text). No reading, question or chamber state is included.
 *  - Openings are questions the member asks, never claims MAIA makes about
 *    them or about what the symbol means for their life.
 *  - The evidence label travels with the text so MAIA can keep tradition,
 *    scholarship and modern practice apart.
 */
import { EVIDENCE, type EvidenceClass } from './evidence';

export type AtlasTradition = 'I Ching' | 'Tarot' | 'Runes';

export interface AskMaiaTopic {
  tradition: AtlasTradition;
  /** The symbol, e.g. "Hexagram 8 · 比 Holding Together", "Ansuz", "Strength". */
  subject: string;
  /** The aspect being asked about, e.g. "History", "Name". Omit for the whole symbol. */
  aspect?: string;
  evidence?: EvidenceClass;
  /** The Atlas text shown to the member for that aspect. */
  body?: string;
}

export const ASK_MAIA_OPENINGS: readonly { key: string; label: string; line: string }[] = [
  { key: 'understand', label: 'Help me understand this', line: 'Can you help me understand this?' },
  {
    key: 'origin',
    label: 'Where does this come from?',
    line: 'Where does this come from, and how sure can we be about it?',
  },
  {
    key: 'readings',
    label: 'How have people read it?',
    line: 'How have different readers understood this, and where do they disagree?',
  },
  {
    key: 'mine',
    label: 'How might this speak to me?',
    line: "I'd like to explore how this might speak to something in my own life. I'll say what.",
  },
];

/** Atlas text is capped so one aspect never floods the conversation. */
export const ASK_MAIA_BODY_LIMIT = 1200;

export function buildAskMaiaContext(topic: AskMaiaTopic): string {
  const head = `From the Divination Atlas — ${topic.tradition}: ${topic.subject}`;
  const lines = [head];
  if (topic.aspect) {
    const ev = topic.evidence ? ` (evidence: ${EVIDENCE[topic.evidence].label})` : '';
    lines.push(`Aspect: ${topic.aspect}${ev}`);
  }
  const body = topic.body?.trim();
  if (body) {
    const clipped = body.length > ASK_MAIA_BODY_LIMIT ? `${body.slice(0, ASK_MAIA_BODY_LIMIT).trimEnd()}…` : body;
    lines.push('', clipped);
  }
  return lines.join('\n');
}

export function withOpening(context: string, line: string): string {
  return `${context}\n\n${line}`;
}
