/** Shared display vocabulary for the Reflections room (Gems and Web views). */

import { Droplets, Flame, Mountain, Star, Wind } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Element } from '@/lib/capsules/types';

/** One icon per element, shared by Keep and Reflections so an element reads the same in every room. */
export const ELEMENT_ICONS: Record<Element, LucideIcon> = {
  fire: Flame,
  water: Droplets,
  earth: Mountain,
  air: Wind,
  aether: Star,
};

/** Quiet provenance cue, never a score (reflections-room contract, composition law). */
export const ELEMENT_TONES: Record<Element, string> = {
  fire: '#d58a28',
  water: '#6f94bd',
  earth: '#9eae6e',
  air: '#c9b995',
  aether: '#9d7fb0',
};

/**
 * The same five elements, deepened for light surfaces such as Keep's white cards (founder
 * ruling C, 2026-11-27). Each holds at least 4.5:1 against white; the
 * Reflections room keeps ELEMENT_TONES.
 */
export const ELEMENT_TONES_ON_LIGHT: Record<Element, string> = {
  fire: '#a65b0c',
  water: '#3d6896',
  earth: '#5c6d30',
  air: '#7a663a',
  aether: '#6c4d86',
};

export const KEPT_TONE = '#d2b078';

export function toneFor(element: string | null | undefined): string {
  return element && Object.prototype.hasOwnProperty.call(ELEMENT_TONES, element)
    ? ELEMENT_TONES[element as Element]
    : KEPT_TONE;
}

export function sourceLabel(source: string) {
  if (source === 'chat' || source === 'conversation') return 'Conversation';
  if (source === 'voice') return 'Voice';
  if (source === 'journal') return 'Journal';
  if (source === 'transcript') return 'Transcript';
  if (source === 'astrology') return 'Astrology';
  if (source === 'divination') return 'Divination';
  return 'Note';
}

/** Lane order on the Web: fixed, so a lane never moves because of how much it holds. */
export const SOURCE_ORDER = ['chat', 'voice', 'journal', 'divination', 'astrology', 'transcript', 'note'] as const;

const FACET_LABELS: Record<string, string> = {
  changes: 'Changes',
  decisions: 'Decisions',
  anchor: 'Daily Anchor',
  journal: 'Journal',
  dream: 'Dream',
  ideas: 'Ideas',
  relationships: 'Relationships',
  divination: 'Divination',
  astrology: 'Astrology',
};

export function facetLabel(facet: string) {
  return FACET_LABELS[facet] ?? facet;
}
