'use client';
/**
 * The words the Studio speaks with for the Work on screen (founder rulings 2026-11-20). Provided by the room from the Work's own
 * program or form; the default is neutral, so a surface outside any provider never says "book" or "chapter" by assumption.
 */
import { createContext, useContext } from 'react';
import { formVocabulary, inFormWords, type FormVocabulary } from './formVocabulary';

const StudioVocabularyContext = createContext<FormVocabulary>(formVocabulary(null));
export const StudioVocabularyProvider = StudioVocabularyContext.Provider;
export function useStudioVocabulary(): FormVocabulary { return useContext(StudioVocabularyContext); }

/** The Studio's own book-worded copy, said in this Work's words (`inFormWords`). For a book it changes nothing. */
export function useFormWords(): (text: string) => string {
  const v = useStudioVocabulary();
  return (text: string) => inFormWords(text, v);
}

/**
 * A place's name in Develop: its own heading, else the name Write gives an untitled place for this Work ("Your draft" when it is
 * the only one, else "Stanza 2" / "Part 2"; a program's own words for a program Work). Develop said "Section 2" for every Work.
 */
export function placeLabel(v: FormVocabulary, s: { heading?: string | null; position: number }, total: number): string {
  const h = s.heading?.trim();
  if (h) return h;
  return total === 1 ? v.place.onlyPlace : `${v.place.part} ${s.position + 1}`;
}
