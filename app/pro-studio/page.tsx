import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth/serverSessions';
import { isFounderMemberId } from '@/lib/founder/founderAuth';
import { resolveProStudioEntrance } from '@/lib/house/entrance';
import { learnAndTryGroups } from '@/lib/proStudio/learnAndTry';
import { LearnAndTryView } from '@/components/pro-studio/LearnAndTryView';

/**
 * HOUSE-ENTRANCE-01 — the Pro Studio door.
 *
 * Founder ruling (2026-11-27): the founder allowlist goes straight into the full
 * studio. That is operator access read server-side from FOUNDER_MEMBER_IDS; it is
 * not a paid entitlement and confers nothing on anyone else. Every other member
 * still gets the limited learn-and-try introduction, because the dedicated
 * provenance-bearing Pro Studio grant does not exist yet (design brief §9), so
 * `proStudioEntitlement` stays 'absent'.
 *
 * Read-only. No write, no practitioner provisioning, no form. It never reads
 * `members.tier`, a practitioner row or `studioMode`. `/studio` keeps its own guards.
 *
 * `?view=intro` lets the founder look at the introduction without being sent on.
 *
 * Deliberately a SIBLING of /pro-studio/reflect: it does not link to it, share its
 * beta flag, or unlock it.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pro Studio — an introduction',
  description: 'What Pro Studio is, what the full studio holds, and what you can do today.',
};

export default async function ProStudioIntroduction({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string | string[] }>;
} = {}) {
  const session = await getCurrentSession();
  const memberId = session?.memberId;
  const entrance = resolveProStudioEntrance({
    signedIn: Boolean(session),
    proStudioEntitlement: 'absent',
    founderAccess: typeof memberId === 'string' && isFounderMemberId(memberId),
  });

  const view = (await searchParams)?.view;
  const wantsIntro = view === 'intro' || (Array.isArray(view) && view.includes('intro'));
  if (entrance === 'full_workspace' && !wantsIntro) redirect('/studio');

  return (
    <LearnAndTryView
      signedIn={entrance !== 'signed_out_intro'}
      hasFullStudio={entrance === 'full_workspace'}
      groups={learnAndTryGroups()}
    />
  );
}
