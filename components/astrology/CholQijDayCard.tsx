/**
 * The traditional Chol Q'ij (K'iche' Maya 260-day count) day for a date, shown
 * first in the Mayan rooms (founder ruling 2026-11-23: traditional primary,
 * Dreamspell secondary).
 *
 * Dates only. The meanings of the nawales are kept by living Ajq'ijab'
 * (daykeepers); none are authored here until a source Soullab has permission
 * to use is in place.
 */
import type { TraditionalMaya } from '@/lib/astrology/proTraditionalMaya';

export function CholQijDayCard({ day, title, showMethod = true }: { day: TraditionalMaya; title: string; showMethod?: boolean }) {
  return (
    <section
      aria-label={title}
      data-testid="chol-qij-day"
      className="bg-gradient-to-br from-stone-900/80 via-amber-950/40 to-stone-900/80 backdrop-blur-xl border border-amber-700/40 rounded-2xl p-8 shadow-2xl"
    >
      <h2 className="text-center text-amber-500/70 text-sm uppercase tracking-wider mb-4">{title}</h2>
      <p className="text-center text-5xl font-bold text-amber-100 mb-2">
        {day.number} {day.kiche}
      </p>
      <p className="text-center text-amber-400/80 text-sm mb-6">
        Chol Q’ij · K’iche’ tradition <span className="text-amber-500/50">(Yucatec {day.number} {day.yucatec})</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm text-amber-200/80 max-w-md mx-auto">
        <dt className="text-amber-500/60">Trecena</dt>
        <dd>Day {day.trecena.position} of 13 in the trecena of 1 {day.trecena.kiche}</dd>
        <dt className="text-amber-500/60">Haab</dt>
        <dd>{day.haab.day} {day.haab.month}</dd>
        <dt className="text-amber-500/60">Long Count</dt>
        <dd>{day.longCount}</dd>
      </dl>
      <p className="text-amber-400/60 text-xs mt-6 text-center leading-relaxed">
        The number and the nawal are read together. The meanings of the nawales are kept by living Ajq’ijab’
        (daykeepers); Soullab does not write its own.
      </p>
      {showMethod && <p className="text-amber-500/40 text-xs mt-3 text-center leading-relaxed">{day.method}</p>}
    </section>
  );
}
