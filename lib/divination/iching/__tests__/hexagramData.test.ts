/**
 * Every hexagram's stored lines must be its King Wen figure, bottom to top.
 *
 * Founder walk 2026-11-25 found 53 drawn upside down. An all-64 check then showed
 * 24 entries whose `lines` disagreed with their own trigrams (18 stored top-down,
 * 6 otherwise wrong) while casts were still identified correctly by trigram.
 */
import { describe, it, expect } from '@jest/globals';
import { HEXAGRAMS } from '../hexagrams';

// Trigram lines bottom→top, 1 = yang.
const TRIGRAM: Record<string, string> = {
  heaven: '111', earth: '000', thunder: '100', water: '010',
  mountain: '001', wind: '011', fire: '101', lake: '110',
};

// King Wen sequence as [lower, upper].
const KING_WEN: Record<number, [string, string]> = {
  1: ['heaven', 'heaven'], 2: ['earth', 'earth'], 3: ['thunder', 'water'], 4: ['water', 'mountain'],
  5: ['heaven', 'water'], 6: ['water', 'heaven'], 7: ['water', 'earth'], 8: ['earth', 'water'],
  9: ['heaven', 'wind'], 10: ['lake', 'heaven'], 11: ['heaven', 'earth'], 12: ['earth', 'heaven'],
  13: ['fire', 'heaven'], 14: ['heaven', 'fire'], 15: ['mountain', 'earth'], 16: ['earth', 'thunder'],
  17: ['thunder', 'lake'], 18: ['wind', 'mountain'], 19: ['lake', 'earth'], 20: ['earth', 'wind'],
  21: ['thunder', 'fire'], 22: ['fire', 'mountain'], 23: ['earth', 'mountain'], 24: ['thunder', 'earth'],
  25: ['thunder', 'heaven'], 26: ['heaven', 'mountain'], 27: ['thunder', 'mountain'], 28: ['wind', 'lake'],
  29: ['water', 'water'], 30: ['fire', 'fire'], 31: ['mountain', 'lake'], 32: ['wind', 'thunder'],
  33: ['mountain', 'heaven'], 34: ['heaven', 'thunder'], 35: ['earth', 'fire'], 36: ['fire', 'earth'],
  37: ['fire', 'wind'], 38: ['lake', 'fire'], 39: ['mountain', 'water'], 40: ['water', 'thunder'],
  41: ['lake', 'mountain'], 42: ['thunder', 'wind'], 43: ['heaven', 'lake'], 44: ['wind', 'heaven'],
  45: ['earth', 'lake'], 46: ['wind', 'earth'], 47: ['water', 'lake'], 48: ['wind', 'water'],
  49: ['fire', 'lake'], 50: ['wind', 'fire'], 51: ['thunder', 'thunder'], 52: ['mountain', 'mountain'],
  53: ['mountain', 'wind'], 54: ['lake', 'thunder'], 55: ['fire', 'thunder'], 56: ['mountain', 'fire'],
  57: ['wind', 'wind'], 58: ['lake', 'lake'], 59: ['water', 'wind'], 60: ['lake', 'water'],
  61: ['lake', 'wind'], 62: ['mountain', 'thunder'], 63: ['fire', 'water'], 64: ['water', 'fire'],
};

const bits = (lines: readonly string[]) => lines.map((l) => (l === 'yang' ? '1' : '0')).join('');

describe('hexagram line data', () => {
  it('has all 64 hexagrams, once each', () => {
    expect(HEXAGRAMS.map((h) => h.number).sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
  });

  it.each(HEXAGRAMS.map((h) => [h.number, h] as const))('%i: trigrams are King Wen', (n, h) => {
    expect([h.trigrams.lower, h.trigrams.upper]).toEqual(KING_WEN[n]);
  });

  it.each(HEXAGRAMS.map((h) => [h.number, h] as const))('%i: lines are lower then upper trigram, bottom to top', (n, h) => {
    const [lower, upper] = KING_WEN[n];
    expect(bits(h.lines)).toBe(TRIGRAM[lower] + TRIGRAM[upper]);
  });
});
