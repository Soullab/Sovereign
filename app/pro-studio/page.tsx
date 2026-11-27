import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth/serverSessions';
import { isFounderMemberId } from '@/lib/founder/founderAuth';
import { resolveProStudioEntrance } from '@/lib/house/entrance';
import { readProStudioGrant } from '@/lib/proStudio/grant';
import { learnAndTryGroups } from '@/lib/proStudio/learnAndTry';
import { LearnAndTryView } from '@/components/pro-studio/LearnAndTryView';

/**
 * HOUSE-ENTRANCE-01 — the Pro Studio door.
 *
 * Two separate facts open the full studio, and either sends the member to /studio:
 *  - Founder ruling (2026-11-27): the founder allowlist (FOUNDER_MEMBER_IDS, read
 *    server-side). Operator access, not an entitlement; confers nothing on anyone else.
 *  - A CURRENT provenance-bearing Pro Studio grant (pro_studio_grants, read
 *    server-side by lib/proStudio/grant — design brief §9). A grant that cannot be
 *    read fails closed to the introduction.
 * Everyone else gets the limited learn-and-try introduction.
 *
 * Read-only. No write, no practitioner provisioning, no form. A signed-out visitor
 * reads no member data. The grant is read only for the session's own member id; this
 * page never reads `members.tier`, a practitioner row or `studioMode`. Opening the
 * workspace door confers nothing else — `/studio` and every client-data and Co-Lab
 * surface keep their own guards.
 *
 * `?view=intro` lets anyone with the full studio look at the introduction without
 * being sent on.
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
  const grant = typeof memberId === 'string' ? await readProStudioGrant(memberId) : null;
  const entrance = resolveProStudioEntrance({
    signedIn: Boolean(session),
    proStudioEntitlement: grant?.entitlement === 'verified' ? 'verified' : 'absent',
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
