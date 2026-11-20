'use client';
/**
 * Whether "Share with Soullab" is drawn (Studio Academy slice 6). Presentation state only: the server page reads
 * WS_SHARE_EXCHANGE_ENABLED once and hands the boolean down; the route re-reads the real flag and refuses on its own.
 * Default false, so every Studio surface without the provider stays dark.
 */
import { createContext, useContext } from 'react';

const ShareExchangeContext = createContext(false);
export const ShareExchangeProvider = ShareExchangeContext.Provider;
export function useShareExchangeEnabled(): boolean { return useContext(ShareExchangeContext); }
