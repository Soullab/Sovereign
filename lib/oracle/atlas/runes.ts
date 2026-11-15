/**
 * Rune Atlas — layered entries for the 24 runes of the Elder Futhark.
 *
 * Each entry separates what is carved in stone from what was reconstructed,
 * written down centuries later, or invented in modern practice. Rune poems
 * and myth are written only where they have been sourced (Ansuz so far);
 * other entries say so rather than borrowing modern lore.
 */
import { ELDER_FUTHARK } from '@/lib/divination/runes/elder-futhark';
import type { Rune } from '@/lib/divination/core/types';
import type { AtlasHistoryEntry, AtlasLayer } from './evidence';

export const RUNE_HISTORY: AtlasHistoryEntry[] = [
  {
    period: '98 CE',
    title: 'Tacitus, Germania 10',
    body: 'Describes Germanic peoples casting lots cut from a fruit-bearing tree and marked with signs. He does not say the signs were runes.',
    evidence: 'documented',
  },
  {
    period: 'c. 150–750 CE',
    title: 'The Elder Futhark',
    body: 'The earliest inscriptions — on combs, brooches, weapons and stones — use 24 runes as an alphabet. The oldest full row is carved on the Kylver stone, Gotland (c. 400 CE).',
    evidence: 'attested',
  },
  {
    period: 'c. 750–1100',
    title: 'Younger rows',
    body: 'Scandinavia reduces the row to 16 runes (the Younger Futhark) while England extends it (the Anglo-Saxon futhorc).',
    evidence: 'attested',
  },
  {
    period: 'c. 9th–15th c.',
    title: 'The rune poems',
    body: 'Old English, Norwegian and Icelandic poems give a verse for each rune name — for the later rows, not the Elder Futhark.',
    evidence: 'later-tradition',
  },
  {
    period: '1908 – 1945',
    title: 'Esoteric and nationalist reinvention',
    body: 'Guido von List’s invented “Armanen” runes feed völkisch movements, and Nazi organisations adopt rune symbols. The Atlas names this history and keeps it apart from the inscriptions.',
    evidence: 'documented',
  },
  {
    period: '1982 – today',
    title: 'Rune divination',
    body: 'Ralph Blum’s The Book of Runes popularises casting runes as an oracle. Most divinatory meanings in use today come from this modern practice.',
    evidence: 'documented',
  },
];

/** Standard scholarly transliteration of each rune, in futhark order. */
const TRANSLITERATION = [
  'f', 'u', 'þ', 'a', 'r', 'k', 'g', 'w',
  'h', 'n', 'i', 'j', 'ï', 'p', 'z', 's',
  't', 'b', 'e', 'm', 'l', 'ŋ', 'd', 'o',
];

/** Reconstructed Proto-Germanic names and their usual glosses. */
const NAMES: Array<{ form: string; gloss: string; uncertain?: boolean }> = [
  { form: '*fehu', gloss: 'cattle, wealth' },
  { form: '*ūruz', gloss: 'aurochs', uncertain: true },
  { form: '*þurisaz', gloss: 'giant' },
  { form: '*ansuz', gloss: 'a god, one of the Æsir' },
  { form: '*raidō', gloss: 'ride, journey' },
  { form: '*kaunan / *kenaz', gloss: 'ulcer, or torch', uncertain: true },
  { form: '*gebō', gloss: 'gift' },
  { form: '*wunjō', gloss: 'joy' },
  { form: '*hagalaz', gloss: 'hail' },
  { form: '*naudiz', gloss: 'need' },
  { form: '*īsaz', gloss: 'ice' },
  { form: '*jēra', gloss: 'year, harvest' },
  { form: '*eihwaz', gloss: 'yew' },
  { form: '*perþō', gloss: 'meaning unknown', uncertain: true },
  { form: '*algiz', gloss: 'elk', uncertain: true },
  { form: '*sōwilō', gloss: 'sun' },
  { form: '*tīwaz', gloss: 'the god Týr' },
  { form: '*berkanan', gloss: 'birch' },
  { form: '*ehwaz', gloss: 'horse' },
  { form: '*mannaz', gloss: 'man, human being' },
  { form: '*laguz', gloss: 'water, lake' },
  { form: '*ingwaz', gloss: 'the god Ing' },
  { form: '*dagaz', gloss: 'day' },
  { form: '*ōþalan', gloss: 'ancestral property' },
];

const ORDINALS = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
];

/** Sourced exemplar layers that sit between the name and modern practice. */
const EXEMPLAR_LAYERS: Record<string, AtlasLayer[]> = {
  ansuz: [
    {
      id: 'poems',
      title: 'Rune poems',
      evidence: 'later-tradition',
      body: 'Centuries later, and for different rune rows, the poems gloss the name differently: the Old English poem calls ōs the origin of all speech; the Norwegian poem reads óss as a river mouth; the Icelandic poem names it as Óðinn.',
      source: 'Old English Rune Poem (c. 8th–10th c.) · Norwegian (c. 13th c.) · Icelandic (c. 15th c.)',
    },
    {
      id: 'myth',
      title: 'Myth',
      evidence: 'literary',
      body: 'In Hávamál, Óðinn hangs nine nights on the windswept tree and takes up the runes. The poem survives in a 13th-century Icelandic manuscript; how far back the myth reaches is debated.',
      source: 'Codex Regius, Poetic Edda · Hávamál st. 138–141',
    },
  ],
};

export interface RuneAtlasEntry {
  slug: string;
  name: string;
  symbol: string;
  position: number;
  aett: number;
  transliteration: string;
  layers: AtlasLayer[];
  hasExemplarLayers: boolean;
  prev: { slug: string; name: string; symbol: string };
  next: { slug: string; name: string; symbol: string };
}

export const runeSlug = (rune: Pick<Rune, 'name'>) => rune.name.toLowerCase();

export function listRunes() {
  return ELDER_FUTHARK.map((r, i) => ({
    slug: runeSlug(r),
    name: r.name,
    symbol: r.symbol,
    position: i + 1,
    aett: Math.floor(i / 8) + 1,
    transliteration: TRANSLITERATION[i],
  }));
}

export function getRuneAtlasEntry(slug: string): RuneAtlasEntry | null {
  const i = ELDER_FUTHARK.findIndex((r) => runeSlug(r) === slug.toLowerCase());
  if (i < 0) return null;
  const rune = ELDER_FUTHARK[i];
  const aett = Math.floor(i / 8) + 1;
  const name = NAMES[i];
  const translit = TRANSLITERATION[i];
  const exemplar = EXEMPLAR_LAYERS[runeSlug(rune)] ?? [];

  const layers: AtlasLayer[] = [
    {
      id: 'inscriptions',
      title: 'In the futhark',
      evidence: 'attested',
      body: `The ${ORDINALS[i % 8]} rune of the ${ORDINALS[aett - 1]} ætt (group of eight), written for the sound transliterated “${translit}”. Carved as an ordinary letter in inscriptions from about 150 to 750 CE.`,
      source: 'Transliteration follows the standard scholarly convention',
    },
    {
      id: 'name',
      title: 'The name',
      evidence: 'reconstructed',
      body: `${name.form} — “${name.gloss}”. No Elder Futhark source records the rune names; they are rebuilt from later Old English, Norse and Gothic letter names.${name.uncertain ? ' This reconstruction is uncertain.' : ''}`,
      source: 'Comparative philology · the asterisk marks a reconstructed form',
    },
    ...exemplar,
  ];

  const assoc = rune.associations;
  const correspondences = [
    rune.element && `element: ${rune.element}`,
    assoc?.deity && `deity: ${assoc.deity}`,
    assoc?.tree && `tree: ${assoc.tree}`,
    assoc?.animal && `animal: ${assoc.animal}`,
    assoc?.color && `colour: ${assoc.color}`,
  ].filter(Boolean) as string[];

  if (correspondences.length > 0) {
    layers.push({
      id: 'correspondences',
      title: 'Correspondences',
      evidence: 'contemporary',
      body: 'Modern esoteric practice links each rune to elements, gods, trees and colours. These links are not found in the early inscriptions.',
      tags: correspondences,
      source: 'Modern esoteric correspondences · source of these attributions not yet recorded',
    });
  }

  layers.push({
    id: 'divination',
    title: 'Divination today',
    evidence: 'contemporary',
    body: rune.uprightMeaning,
    tags: rune.keywords,
    source: 'Modern rune divination · source of this wording not yet recorded',
  });

  const at = (j: number) => {
    const r = ELDER_FUTHARK[(j + 24) % 24];
    return { slug: runeSlug(r), name: r.name, symbol: r.symbol };
  };

  return {
    slug: runeSlug(rune),
    name: rune.name,
    symbol: rune.symbol,
    position: i + 1,
    aett,
    transliteration: translit,
    layers,
    hasExemplarLayers: exemplar.length > 0,
    prev: at(i - 1),
    next: at(i + 1),
  };
}
