/**
 * Tarot Atlas — layered entries for the 78 cards.
 *
 * A card's place in the deck is old and documented; its esoteric
 * correspondences are 19th-century; its divinatory meanings are modern.
 * The Atlas keeps those apart and labels each.
 */
import { MAJOR_ARCANA } from '@/lib/divination/tarot/major-arcana';
import { MINOR_ARCANA } from '@/lib/divination/tarot/minor-arcana';
import type { TarotCard, TarotSuit } from '@/lib/divination/core/types';
import type { AtlasHistoryEntry, AtlasLayer } from './evidence';

export const TAROT_HISTORY: AtlasHistoryEntry[] = [
  {
    period: 'c. 1440–1470',
    title: 'Carte da trionfi',
    body: 'In the courts of northern Italy, a fifth suit of illustrated “triumphs” is added to ordinary playing cards. Hand-painted decks made for the Visconti and Sforza families of Milan survive.',
    evidence: 'attested',
  },
  {
    period: '16th–18th c.',
    title: 'A card game',
    body: 'Tarot spreads across Europe as a trick-taking game. The Tarot de Marseille pattern fixes the order and look of the trumps for centuries.',
    evidence: 'documented',
  },
  {
    period: '1781',
    title: 'An invented ancient past',
    body: 'Antoine Court de Gébelin claims the trumps preserve the wisdom of ancient Egypt. No evidence supports this, but the idea shapes everything after.',
    evidence: 'documented',
  },
  {
    period: 'c. 1789',
    title: 'Etteilla',
    body: 'Jean-Baptiste Alliette, writing as Etteilla, publishes one of the first decks designed for divination.',
    evidence: 'documented',
  },
  {
    period: 'from 1888',
    title: 'The Golden Dawn',
    body: 'The Hermetic Order of the Golden Dawn ties the trumps to the Hebrew alphabet, the paths of the Kabbalistic Tree of Life, astrology and the elements.',
    evidence: 'esoteric-tradition',
  },
  {
    period: '1909',
    title: 'Rider–Waite–Smith',
    body: 'A. E. Waite and the artist Pamela Colman Smith publish a deck with every suit card illustrated as a scene. Most modern decks follow its imagery.',
    evidence: 'documented',
  },
  {
    period: '20th c. – today',
    title: 'Psychological reading',
    body: 'Readers influenced by Jung treat the trumps as archetypes and the reading as reflection rather than prediction.',
    evidence: 'contemporary',
  },
];

const SUIT_LABEL: Record<TarotSuit, string> = {
  wands: 'Wands',
  cups: 'Cups',
  swords: 'Swords',
  pentacles: 'Pentacles',
};

const SUIT_ORIGIN: Record<TarotSuit, string> = {
  wands: 'batons (bastoni)',
  cups: 'cups (coppe)',
  swords: 'swords (spade)',
  pentacles: 'coins (denari)',
};

const RANK = ['', 'Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'];

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];

export const ALL_CARDS: TarotCard[] = [...MAJOR_ARCANA, ...MINOR_ARCANA];

export function cardLabel(card: TarotCard): string {
  return card.arcana === 'major' ? ROMAN[card.number] ?? String(card.number) : RANK[card.number] ?? String(card.number);
}

export function listCards() {
  const majors = MAJOR_ARCANA.map((c) => ({ id: c.id, name: c.name, label: cardLabel(c) }));
  const suits = (['wands', 'cups', 'swords', 'pentacles'] as TarotSuit[]).map((suit) => ({
    suit,
    label: SUIT_LABEL[suit],
    cards: MINOR_ARCANA.filter((c) => c.suit === suit)
      .sort((a, b) => a.number - b.number)
      .map((c) => ({ id: c.id, name: c.name, label: cardLabel(c) })),
  }));
  return { majors, suits };
}

export interface TarotAtlasEntry {
  id: string;
  name: string;
  arcana: 'major' | 'minor';
  label: string;
  suit?: string;
  layers: AtlasLayer[];
  prev: { id: string; name: string };
  next: { id: string; name: string };
}

function deckLayer(card: TarotCard): AtlasLayer {
  if (card.arcana === 'major') {
    let body =
      card.number === 0
        ? 'The Fool: unnumbered in early decks, numbered 0 in later ones, and placed at the start or end of the 22 trumps (the Major Arcana).'
        : `Trump ${ROMAN[card.number]} of the 22 trumps, the cards later called the Major Arcana.`;
    if (card.name === 'Strength' || card.name === 'Justice') {
      body += ' Rider–Waite–Smith swaps Strength (VIII) and Justice (XI) from their places in the Marseille order.';
    }
    return { id: 'deck', title: 'In the deck', evidence: 'documented', body };
  }
  const suit = card.suit as TarotSuit;
  return {
    id: 'deck',
    title: 'In the deck',
    evidence: 'documented',
    body: `${RANK[card.number]} of ${SUIT_LABEL[suit]}, one of the 56 suit cards. The suit descends from the Italian playing-card suit of ${SUIT_ORIGIN[suit]}.${suit === 'pentacles' ? ' “Pentacles” is the later esoteric name for coins.' : ''}`,
  };
}

export function getTarotAtlasEntry(id: string): TarotAtlasEntry | null {
  const i = ALL_CARDS.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const card = ALL_CARDS[i];

  const layers: AtlasLayer[] = [deckLayer(card)];

  if (card.symbolism?.length) {
    layers.push({
      id: 'imagery',
      title: 'Imagery',
      evidence: 'traditional',
      body: 'Elements of the picture to look for. Early decks drew most suit cards as plain pips; the scenes most people know come from the Rider–Waite–Smith deck (1909) and the decks that follow it.',
      tags: card.symbolism,
      source: 'Soullab card library · the deck behind each detail is not yet recorded',
    });
  }

  const corr = [
    card.element && `element: ${card.element}`,
    card.astrological && `astrology: ${card.astrological}`,
    card.hebrewLetter && `Hebrew letter: ${card.hebrewLetter}`,
    card.path && `Tree of Life path: ${card.path}`,
    card.decanCorrespondence && `decan: ${card.decanCorrespondence}`,
    card.numerology && `number: ${card.numerology}`,
  ].filter(Boolean) as string[];
  if (corr.length > 0) {
    layers.push({
      id: 'correspondences',
      title: 'Correspondences',
      evidence: 'esoteric-tradition',
      body: 'From 1888 the Golden Dawn and later occultists tied the cards to Hebrew letters, Kabbalistic paths, astrology and the elements. Different schools assign them differently.',
      tags: corr,
      source: 'Esoteric correspondences · the school behind each attribution is not yet recorded',
    });
  }

  layers.push({
    id: 'divination',
    title: 'Divination today',
    evidence: 'contemporary',
    body: card.reversedMeaning
      ? `${card.uprightMeaning} Reversed: ${card.reversedMeaning}`
      : card.uprightMeaning,
    tags: card.keywords,
    source: 'Modern divinatory reading · source of this wording not yet recorded',
  });

  const at = (j: number) => {
    const c = ALL_CARDS[(j + ALL_CARDS.length) % ALL_CARDS.length];
    return { id: c.id, name: c.name };
  };

  return {
    id: card.id,
    name: card.name,
    arcana: card.arcana,
    label: cardLabel(card),
    suit: card.suit ? SUIT_LABEL[card.suit] : undefined,
    layers,
    prev: at(i - 1),
    next: at(i + 1),
  };
}
