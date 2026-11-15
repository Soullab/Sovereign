/**
 * I Ching Living Explorer — content model.
 *
 * Everything here carries its evidence class so the chamber can show how
 * strong a claim is, not only what it says. Tradition-level content (history,
 * trigrams, sovereign hexagrams, casting odds) applies to every hexagram.
 * Hexagram-specific commentary exists only where it has been written and
 * sourced; elsewhere the Explorer says so instead of filling the gap.
 *
 * Pure data and functions: no network, no member data.
 */
import { getHexagram } from '@/lib/divination/iching/hexagrams';
import { EVIDENCE, type AtlasHistoryEntry, type EvidenceClass } from '@/lib/oracle/atlas/evidence';

export type { EvidenceClass };

export const EVIDENCE_LABEL: Record<EvidenceClass, string> = Object.fromEntries(
  Object.entries(EVIDENCE).map(([k, v]) => [k, v.label])
) as Record<EvidenceClass, string>;

export type HistoryEntry = AtlasHistoryEntry;

/** The layers of the text, oldest first. */
export const ICHING_HISTORY: HistoryEntry[] = [
  {
    period: 'c. 1000–750 BCE',
    title: 'The Zhouyi',
    body: 'The core text — hexagram and line statements — takes shape in the Western Zhou as a manual for diviners.',
    evidence: 'scholarly-consensus',
  },
  {
    period: 'c. 400–200 BCE',
    title: 'The Ten Wings',
    body: 'Commentaries add cosmology and ethics, turning an oracle into a philosophy of change. Tradition credits Confucius; scholars date them later.',
    evidence: 'attribution-disputed',
  },
  {
    period: '168 BCE',
    title: 'The Mawangdui manuscript',
    body: 'A silk copy buried in a Han tomb (found 1973) orders the 64 hexagrams differently from the received text.',
    evidence: 'archaeological',
  },
  {
    period: '226 CE – today',
    title: 'Readers across centuries',
    body: 'Wang Bi, Cheng Yi and Zhu Xi re-read the text; Leibniz saw binary arithmetic in it; Jung wrote the foreword to Wilhelm’s translation.',
    evidence: 'documented',
  },
];

export type TrigramKey =
  | 'heaven' | 'earth' | 'thunder' | 'water'
  | 'mountain' | 'wind' | 'fire' | 'lake';

export interface Trigram {
  key: TrigramKey;
  symbol: string;
  pinyin: string;
  hanzi: string;
  image: string;
  quality: string;
}

/** The eight trigrams with their classical images and qualities. */
export const TRIGRAMS: Record<TrigramKey, Trigram> = {
  heaven: { key: 'heaven', symbol: '☰', pinyin: 'Qián', hanzi: '乾', image: 'Heaven', quality: 'creative, strong' },
  earth: { key: 'earth', symbol: '☷', pinyin: 'Kūn', hanzi: '坤', image: 'Earth', quality: 'receptive, yielding' },
  thunder: { key: 'thunder', symbol: '☳', pinyin: 'Zhèn', hanzi: '震', image: 'Thunder', quality: 'arousing, moving' },
  water: { key: 'water', symbol: '☵', pinyin: 'Kǎn', hanzi: '坎', image: 'Water', quality: 'abysmal, dangerous' },
  mountain: { key: 'mountain', symbol: '☶', pinyin: 'Gèn', hanzi: '艮', image: 'Mountain', quality: 'keeping still' },
  wind: { key: 'wind', symbol: '☴', pinyin: 'Xùn', hanzi: '巽', image: 'Wind, wood', quality: 'gentle, penetrating' },
  fire: { key: 'fire', symbol: '☲', pinyin: 'Lí', hanzi: '離', image: 'Fire', quality: 'clinging, bright' },
  lake: { key: 'lake', symbol: '☱', pinyin: 'Duì', hanzi: '兌', image: 'Lake', quality: 'joyous' },
};

/**
 * The twelve "sovereign" (xiāoxī, waxing-and-waning) hexagrams, which map
 * yang's growth and decline across the lunar months. Month 11 holds the
 * winter solstice.
 */
export const SOVEREIGN_HEXAGRAMS: Array<{ hexagram: number; month: number }> = [
  { hexagram: 24, month: 11 },
  { hexagram: 19, month: 12 },
  { hexagram: 11, month: 1 },
  { hexagram: 34, month: 2 },
  { hexagram: 43, month: 3 },
  { hexagram: 1, month: 4 },
  { hexagram: 44, month: 5 },
  { hexagram: 33, month: 6 },
  { hexagram: 12, month: 7 },
  { hexagram: 20, month: 8 },
  { hexagram: 23, month: 9 },
  { hexagram: 2, month: 10 },
];

export function sovereignPosition(hexagram: number) {
  const index = SOVEREIGN_HEXAGRAMS.findIndex((s) => s.hexagram === hexagram);
  if (index < 0) return null;
  const prev = SOVEREIGN_HEXAGRAMS[(index + 11) % 12];
  const next = SOVEREIGN_HEXAGRAMS[(index + 1) % 12];
  return { ...SOVEREIGN_HEXAGRAMS[index], prev: prev.hexagram, next: next.hexagram };
}

/** Odds of each line value, out of 16, for the two casting methods. */
export const CASTING_ODDS: Array<{ value: 6 | 7 | 8 | 9; label: string; yarrow: number; coins: number }> = [
  { value: 6, label: 'old yin, changing', yarrow: 1, coins: 2 },
  { value: 7, label: 'young yang', yarrow: 5, coins: 6 },
  { value: 8, label: 'young yin', yarrow: 7, coins: 6 },
  { value: 9, label: 'old yang, changing', yarrow: 3, coins: 2 },
];

export interface Commentary {
  author: string;
  dates: string;
  heading: string;
  body: string;
}

export interface HexagramCommentary {
  note: string;
  readings: Commentary[];
  sources: string[];
}

/**
 * Hexagram-specific commentary. Only exemplar entries exist so far; each
 * entry names where its claims come from.
 */
export const HEXAGRAM_COMMENTARY: Record<number, HexagramCommentary> = {
  24: {
    note: 'The Tuan commentary says that in Return one sees the heart of heaven and earth. Later readers disagreed about what that heart is.',
    readings: [
      {
        author: 'Wang Bi',
        dates: '226–249',
        heading: 'Return to the root',
        body: 'Return means going back to the source. The heart of heaven and earth is stillness — what remains when movement ceases.',
      },
      {
        author: 'Cheng Yi',
        dates: '1033–1107',
        heading: 'The first stir of movement',
        body: 'Earlier readers saw stillness, but the beginning of movement is the heart of heaven and earth. Zhu Xi follows him.',
      },
    ],
    sources: [
      'Tuan zhuan on hexagram 24 (one of the Ten Wings)',
      'Wang Bi, Zhouyi zhu; tr. R. J. Lynn, The Classic of Changes (1994)',
      'Cheng Yi, Yichuan Yizhuan',
    ],
  },
};

export interface ExplorerEntry {
  number: number;
  chineseName?: string;
  englishName?: string;
  judgment?: string;
  image?: string;
  lineTexts: string[];
  upper?: Trigram;
  lower?: Trigram;
  sovereign: ReturnType<typeof sovereignPosition>;
  commentary: HexagramCommentary | null;
}

function asTrigram(key: string | undefined): Trigram | undefined {
  return key && key in TRIGRAMS ? TRIGRAMS[key as TrigramKey] : undefined;
}

/** Everything the Explorer shows for one hexagram. */
export function getExplorerEntry(number: number): ExplorerEntry | null {
  const hex = getHexagram(number);
  if (!hex) return null;
  return {
    number,
    chineseName: hex.chineseName,
    englishName: hex.englishName,
    judgment: hex.judgment,
    image: hex.image,
    lineTexts: hex.changingLinesMeanings ?? [],
    upper: asTrigram(hex.trigrams?.upper),
    lower: asTrigram(hex.trigrams?.lower),
    sovereign: sovereignPosition(number),
    commentary: HEXAGRAM_COMMENTARY[number] ?? null,
  };
}
