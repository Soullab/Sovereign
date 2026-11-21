import type { Metadata } from 'next';
import { Inter, Newsreader } from 'next/font/google';
import { WelcomeInvitation } from './WelcomeInvitation';

/**
 * WS-WELCOME-01 — the invitation a new writer is sent to (founder request 2026-11-21:
 * "the more we can guide our new writers initially the better until we learn from them what works").
 *
 * ⛔ No member is named in this source. The greeting comes from the signed-in writer's own account
 *    (`useMemberIdentity` → /api/members/me). Signed out, the page greets no one by name.
 * ⛔ Collects nothing, tracks nothing, stores nothing. Learning what works comes from talking with
 *    writers, not from instrumenting them.
 * ⛔ Claim discipline: every capability named here is live. What is NOT live is said plainly
 *    (no automatic proofreading; MAIA reads a portion at a time; where her reading goes).
 */
const serif = Newsreader({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--wl-serif', display: 'swap' });
const sans = Inter({ subsets: ['latin'], variable: '--wl-sans', display: 'swap' });

export const metadata: Metadata = {
  title: "Welcome to Writer's Studio · Soullab",
  robots: { index: false, follow: false },
};

export default function WritersStudioWelcomePage() {
  return (
    <div className={`${serif.variable} ${sans.variable}`}>
      <WelcomeInvitation />
    </div>
  );
}
