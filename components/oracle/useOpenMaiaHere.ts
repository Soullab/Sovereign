'use client';

/**
 * Bring a Divination reading to MAIA without leaving the room.
 *
 * /oracle is a governed MAIA room (founder ruling 2026-11-25), so a signed-in
 * member's conversation opens over the page they are on. Only when the
 * presence layer cannot host does the message travel by the one-shot seed to
 * /maia/encounter. Bare /maia is a threshold and never receives a reading;
 * the old `/maia?context=` hand-off put the reading in the URL and lost it.
 *
 * Same rule as the Atlas (components/oracle/atlas/AskMaia.tsx).
 */
import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { seedMaiaPrompt } from '@/lib/maia/seedPrompt';
import { useMaiaPresence } from '@/components/maia/presence/MaiaPresence';

export interface OpenMaiaHereOptions {
  /** Origin tag for the seed fallback, e.g. 'divination:tarot'. */
  source: string;
  /** Human-readable label MAIA may reference, e.g. 'Tarot reading'. */
  sourceLabel: string;
}

export function useOpenMaiaHere(): (prompt: string, options: OpenMaiaHereOptions) => void {
  const router = useRouter();
  const pathname = usePathname();
  const presence = useMaiaPresence();

  return useCallback(
    (prompt: string, { source, sourceLabel }: OpenMaiaHereOptions) => {
      const text = prompt.trim();
      if (!text) return;
      if (presence?.canHost) {
        presence.openMaiaWith(text);
        return;
      }
      seedMaiaPrompt({ prompt: text, source, sourceLabel, returnTo: pathname ?? '/oracle' });
      router.push('/maia/encounter');
    },
    [presence, pathname, router],
  );
}
