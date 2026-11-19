'use client';
/**
 * Whether recorded journey answers are offered (Studio Academy slice 5). Presentation state only: the server page reads
 * WS_JOURNEY_RECORDINGS_ENABLED once and hands the boolean down; the route re-reads the real flag and refuses on its own.
 * Default false, so every surface without the provider stays dark.
 */
import { createContext, useContext } from 'react';

const JourneyRecordingsContext = createContext(false);
export const JourneyRecordingsProvider = JourneyRecordingsContext.Provider;
export function useJourneyRecordingsEnabled(): boolean { return useContext(JourneyRecordingsContext); }
