import Link from 'next/link';
import type { LearnAndTryGroup } from '@/lib/proStudio/learnAndTry';

/**
 * Pro Studio introduction (HOUSE-ENTRANCE-01, Stage 1).
 *
 * A threshold, not a funnel: it explains, and offers the one thing that is real
 * today — a conversation with MAIA. No form, no enrollment, no price, no tier,
 * no claim about anything not yet built.
 *
 * Layout: the one action sits beside the arrival sentence so it is reachable
 * without scrolling; the studio's parts follow as quiet, scannable cards.
 * `hasFullStudio` is only true for someone the page would otherwise have sent
 * straight into /studio (they asked to see the introduction); it adds a way on.
 */
const PRIMARY_BUTTON =
  'inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#263e3a] px-6 py-3 text-base font-medium text-white transition-colors hover:bg-[#1b302d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#263e3a] sm:w-auto';

export function LearnAndTryView({
  signedIn,
  groups,
  hasFullStudio = false,
}: {
  signedIn: boolean;
  groups: LearnAndTryGroup[];
  hasFullStudio?: boolean;
}) {
  const partCount = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <main className="min-h-screen bg-[#f5f2ea] text-[#292d32]">
      {hasFullStudio && (
        <div className="border-b border-[#263e3a]/15 bg-[#263e3a] text-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm md:px-10">
            <p>You are viewing the introduction other members see.</p>
            <Link href="/studio" className="font-medium underline underline-offset-4 hover:text-white/80">
              Go to your studio →
            </Link>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10 md:py-12">
        <header className="flex items-center justify-between gap-6 border-b border-stone-300/70 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.23em] text-stone-600">Soullab · Pro Studio</p>
            <p className="mt-1 text-xl font-light tracking-tight">An introduction</p>
          </div>
          <Link href="/home" className="text-sm text-stone-700 underline underline-offset-4 hover:text-stone-950">
            Return to Soullab
          </Link>
        </header>

        <section
          aria-labelledby="pro-studio-intro-title"
          className="grid gap-10 py-12 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:items-start md:gap-14 md:py-16"
        >
          <div>
            <h1 id="pro-studio-intro-title" className="text-4xl font-light leading-[1.1] tracking-tight md:text-[3.25rem]">
              A workspace for the work you do with others.
            </h1>
            <p className="mt-7 text-lg leading-relaxed text-stone-700">
              Pro Studio is where a practitioner holds their people, their sessions, and the
              continuity of their work. You can look around and talk with MAIA about your
              practice. Nothing here signs you up for anything.
            </p>
            <p className="mt-6 border-l-2 border-[#263e3a]/30 pl-4 text-sm leading-relaxed text-stone-600">
              Your own space with MAIA is separate and is yours whether or not you ever use Pro
              Studio. Neither needs the other.
            </p>
          </div>

          <div
            aria-labelledby="pro-studio-today-title"
            className="rounded-2xl border border-stone-300 bg-[#fffdf8] p-6 shadow-sm md:p-8"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#263e3a]/80">What you can do today</p>
            <h2 id="pro-studio-today-title" className="mt-3 text-2xl font-normal leading-snug tracking-tight">
              Talk with MAIA about your practice
            </h2>
            <p className="mt-3 leading-relaxed text-stone-700">
              Bring what you are working with, or what you are wondering about. You decide
              what matters and what, if anything, to carry forward.
            </p>
            <div className="mt-6">
              {signedIn ? (
                <Link href="/maia/encounter" className={PRIMARY_BUTTON}>
                  Talk with MAIA about your practice
                </Link>
              ) : (
                <Link href="/signin?next=%2Fpro-studio" className={PRIMARY_BUTTON}>
                  Sign in to talk with MAIA
                </Link>
              )}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-stone-500">
              This opens the existing MAIA conversation. It does not create a practitioner
              profile or send anything to a professional workspace.
            </p>
          </div>
        </section>

        <section aria-labelledby="pro-studio-holds-title" className="border-t border-stone-300/70 py-12">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 id="pro-studio-holds-title" className="text-2xl font-light tracking-tight">What the full studio holds</h2>
            <p className="text-sm text-stone-500">{partCount} parts, in {groups.length} areas</p>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
            These belong to the full studio. They are not open from this page.
          </p>

          <div className="mt-8 gap-5 md:columns-2">
            {groups.map((group) => (
              <div
                key={group.title}
                className="mb-5 break-inside-avoid rounded-2xl border border-stone-300/70 bg-[#fffdf8]/60 p-5 md:p-6"
              >
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{group.title}</h3>
                <ul className="mt-4 divide-y divide-stone-200/80">
                  {group.items.map((item) => (
                    <li key={item.label} className="py-3 first:pt-0 last:pb-0">
                      <span className="font-medium">{item.label}</span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-stone-600">{item.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-stone-300/70 pt-6 text-sm leading-relaxed text-stone-600 sm:flex-row sm:items-baseline sm:justify-between">
          <p>How access to the full studio works, and what it includes, has not been set yet.</p>
          {signedIn && (
            <p>
              Already have a Pro Studio?{' '}
              <Link href="/studio" className="font-medium text-stone-800 underline underline-offset-4 hover:text-stone-950">Open it</Link>.
            </p>
          )}
        </footer>
      </div>
    </main>
  );
}
