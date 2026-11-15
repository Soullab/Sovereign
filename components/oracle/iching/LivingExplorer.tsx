'use client';

/**
 * I Ching Living Explorer — the depth beneath a consultation.
 *
 * Shown after a reading. Five fields (text, history, metaphysics,
 * commentaries, practice), each claim labelled with its evidence class.
 * It reads the local hexagram library and sends nothing on its own. On Atlas
 * pages (askMaia set) each field offers Ask MAIA: the member reads and edits
 * the field's public Atlas text before choosing to send it. In the chamber
 * askMaia is not set, so no reading content can travel from here.
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { divinationType } from '@/lib/oracle/divinationTypography';
import {
  CASTING_ODDS,
  EVIDENCE_LABEL,
  ICHING_HISTORY,
  getExplorerEntry,
  type EvidenceClass,
} from '@/lib/oracle/ichingExplorer';
import { AskMaia } from '@/components/oracle/atlas/AskMaia';

const TABS = [
  { id: 'text', label: 'The Text' },
  { id: 'history', label: 'History' },
  { id: 'metaphysics', label: 'Metaphysics' },
  { id: 'commentaries', label: 'Commentaries' },
  { id: 'practice', label: 'Practice' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface LivingExplorerProps {
  hexagramNumber: number;
  changingLines?: number[];
  /** When set, shows a link to this hexagram's full Atlas entry. */
  atlasHref?: string;
  /** Atlas only: offers Ask MAIA on every field, naming the hexagram as `subject`. */
  askMaia?: { subject: string };
}

type Entry = NonNullable<ReturnType<typeof getExplorerEntry>>;

/** The public Atlas text of one field — exactly what the member is shown. */
function explorerFieldText(entry: Entry, tab: TabId): { body: string; evidence?: EvidenceClass } {
  switch (tab) {
    case 'text':
      return {
        body: [entry.judgment && `Judgment: ${entry.judgment}`, entry.image && `The Image: ${entry.image}`]
          .filter(Boolean)
          .join('\n'),
      };
    case 'history':
      return { body: ICHING_HISTORY.map((h) => `${h.period}: ${h.title}.`).join('\n') };
    case 'metaphysics': {
      const tri = entry.upper && entry.lower
        ? `Upper trigram ${entry.upper.image} (${entry.upper.pinyin}, ${entry.upper.quality}); lower trigram ${entry.lower.image} (${entry.lower.pinyin}, ${entry.lower.quality}).`
        : '';
      const sov = entry.sovereign
        ? `One of the twelve sovereign hexagrams, standing for lunar month ${entry.sovereign.month}.`
        : '';
      return { body: [tri, sov].filter(Boolean).join('\n'), evidence: 'traditional' };
    }
    case 'commentaries':
      return entry.commentary
        ? {
            body: [entry.commentary.note, ...entry.commentary.readings.map((r) => `${r.author} (${r.dates}): ${r.heading}`)].join('\n'),
          }
        : { body: 'No sourced commentary for this hexagram is in the Atlas yet.' };
    case 'practice':
      return {
        body: CASTING_ODDS.map((o) => `${o.value} ${o.label}: yarrow ${o.yarrow} in 16, coins ${o.coins} in 16.`).join('\n'),
      };
  }
}

function Evidence({ kind }: { kind: EvidenceClass }) {
  return (
    <span className="inline-block rounded-md border border-[#D4B896]/30 px-2 py-0.5 text-[12px] uppercase tracking-[0.1em] text-[#D4B896]">
      {EVIDENCE_LABEL[kind]}
    </span>
  );
}

export function LivingExplorer({ hexagramNumber, changingLines = [], atlasHref, askMaia }: LivingExplorerProps) {
  const entry = getExplorerEntry(hexagramNumber);
  const [tab, setTab] = useState<TabId>('text');
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (!entry) return null;

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  const title = entry.englishName ?? `Hexagram ${entry.number}`;

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className="bg-white/[0.03] backdrop-blur-xl border border-[#D4B896]/20 rounded-2xl p-6 sm:p-8 shadow-2xl"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
        <h3 id={`${baseId}-title`} className={`${divinationType.sectionTitle} text-white`}>
          Explore {title}
        </h3>
        {atlasHref ? (
          <Link
            href={atlasHref}
            className={`${divinationType.metadata} inline-flex items-center min-h-[44px] text-[#cfbdd8] hover:text-white border-b border-[#a99ab6]/40`}
          >
            Open in the Atlas →
          </Link>
        ) : (
          <p className={`${divinationType.metadata} text-white/55`}>
            Living Explorer · every claim shows its evidence
          </p>
        )}
      </div>

      <div role="tablist" aria-label="Explorer fields" className="flex flex-wrap gap-1.5 mb-6">
        {TABS.map((t, i) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={`min-h-[44px] rounded-full px-4 text-[14px] font-medium transition-colors border ${
                selected
                  ? 'bg-[#D4B896]/15 border-[#D4B896]/45 text-[#F3DDBF]'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${tab}`}
        aria-labelledby={`${baseId}-tab-${tab}`}
        tabIndex={0}
        className="focus:outline-none"
      >
        {tab === 'text' && (
          <div className="space-y-6">
            {entry.chineseName && (
              <p className={`${divinationType.roomTitle} text-[#E4C8A6]`} lang="zh">
                {entry.chineseName}
              </p>
            )}
            {entry.judgment && (
              <div>
                <h4 className={`${divinationType.fieldLabel} text-[#D4B896] mb-2`}>Judgment</h4>
                <p className={`${divinationType.fieldBody} text-white/80`}>{entry.judgment}</p>
              </div>
            )}
            {entry.image && (
              <div>
                <h4 className={`${divinationType.fieldLabel} text-[#D4B896] mb-2`}>The Image</h4>
                <p className={`${divinationType.fieldBody} text-white/80`}>{entry.image}</p>
              </div>
            )}
            {changingLines.length > 0 && (
              <div className="space-y-3">
                <h4 className={`${divinationType.fieldLabel} text-[#D4B896]`}>Your changing lines</h4>
                {changingLines.map((n) => (
                  <p
                    key={n}
                    className={`${divinationType.fieldBody} text-white/80 rounded-xl border border-[#F3DDBF]/20 bg-[#D4B896]/[0.06] p-4`}
                  >
                    {entry.lineTexts[n - 1] ?? `Line ${n}`}
                  </p>
                ))}
              </div>
            )}
            <p className={`${divinationType.metadata} text-white/50`}>
              Rendering from Soullab’s hexagram library. The translation it follows is not yet recorded.
            </p>
          </div>
        )}

        {tab === 'history' && (
          <ol className="divide-y divide-[#D4B896]/10">
            {ICHING_HISTORY.map((h) => (
              <li key={h.period} className="flex flex-col sm:flex-row gap-2 sm:gap-6 py-4">
                <p className={`${divinationType.itemTitle} sm:w-40 shrink-0 text-[#E4C8A6]`}>{h.period}</p>
                <div className="space-y-2">
                  <p className={`${divinationType.support} text-white/80`}>
                    <span className="font-semibold text-white">{h.title}.</span> {h.body}
                  </p>
                  <Evidence kind={h.evidence} />
                </div>
              </li>
            ))}
          </ol>
        )}

        {tab === 'metaphysics' && (
          <div className="space-y-6">
            <div>
              <p className={`${divinationType.fieldBody} text-white/85`}>
                <span lang="zh" className="text-[#E4C8A6]">一陰一陽之謂道</span> — “One yin, one yang: this is called the Way.”
              </p>
              <p className={`${divinationType.metadata} text-white/50 mt-1`}>
                Xici zhuan (Great Treatise), one of the Ten Wings
              </p>
            </div>
            {entry.upper && entry.lower && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { pos: 'Upper trigram', t: entry.upper },
                  { pos: 'Lower trigram', t: entry.lower },
                ].map(({ pos, t }) => (
                  <div key={pos} className="rounded-xl border border-[#D4B896]/15 bg-black/20 p-4 flex gap-4 items-center">
                    <span aria-hidden="true" className="text-4xl text-[#E4C8A6] leading-none">{t.symbol}</span>
                    <div>
                      <p className={`${divinationType.metadata} text-white/55`}>{pos}</p>
                      <p className={`${divinationType.itemTitle} text-white`}>
                        {t.image} · <span lang="zh">{t.hanzi}</span> {t.pinyin}
                      </p>
                      <p className={`${divinationType.metadata} text-white/65`}>{t.quality}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {entry.sovereign ? (
              <p className={`${divinationType.support} text-white/75`}>
                This is one of the twelve sovereign hexagrams that trace yang’s growth and decline through the year.
                It stands for lunar month {entry.sovereign.month}
                {entry.sovereign.month === 11 ? ', the month of the winter solstice' : ''}, between hexagrams{' '}
                {entry.sovereign.prev} and {entry.sovereign.next}.
              </p>
            ) : (
              <p className={`${divinationType.support} text-white/75`}>
                Read the figure as its two trigrams meeting: what the lower image brings, and what the upper image meets it with.
              </p>
            )}
            <Evidence kind="traditional" />
          </div>
        )}

        {tab === 'commentaries' &&
          (entry.commentary ? (
            <div className="space-y-5">
              <p className={`${divinationType.support} text-white/80`}>{entry.commentary.note}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entry.commentary.readings.map((r) => (
                  <div key={r.author} className="rounded-xl border border-[#D4B896]/15 bg-black/20 p-5 space-y-2">
                    <p className={`${divinationType.marker} text-[#D4B896]`}>
                      {r.author} · {r.dates}
                    </p>
                    <p className={`${divinationType.itemTitle} text-white`}>{r.heading}</p>
                    <p className={`${divinationType.support} text-white/75`}>{r.body}</p>
                  </div>
                ))}
              </div>
              <p className={`${divinationType.support} text-white/65`}>
                The Explorer shows the disagreement rather than settling it.
              </p>
              <ul className={`${divinationType.metadata} text-white/50 list-disc pl-5 space-y-1`}>
                {entry.commentary.sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className={`${divinationType.support} text-white/70`}>
              Commentaries for this hexagram haven’t been written and sourced yet. Rather than fill the space, the
              Explorer leaves it open. The History and Metaphysics fields apply to every hexagram.
            </p>
          ))}

        {tab === 'practice' && (
          <div className="space-y-5">
            <p className={`${divinationType.support} text-white/80`}>
              How you cast changes the odds of change. This chamber uses yarrow-stalk odds.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left border-collapse">
                <caption className="sr-only">Odds of each line value by casting method, out of 16</caption>
                <thead>
                  <tr className={`${divinationType.marker} text-[#D4B896]`}>
                    <th scope="col" className="py-3 pr-4 font-medium">Line</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Yarrow</th>
                    <th scope="col" className="py-3 font-medium">Three coins</th>
                  </tr>
                </thead>
                <tbody className={`${divinationType.support} text-white/80`}>
                  {CASTING_ODDS.map((o) => (
                    <tr key={o.value} className="border-t border-[#D4B896]/10">
                      <th scope="row" className="py-3 pr-4 font-normal">
                        {o.value} · {o.label}
                      </th>
                      <td className="py-3 pr-4">{o.yarrow} in 16</td>
                      <td className="py-3">{o.coins} in 16</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={`${divinationType.support} text-white/70`}>
              With yarrow, a changing yang line is three times as likely as a changing yin line. With coins they are equally likely.
            </p>
          </div>
        )}

        {askMaia && (
          <div className="mt-6 pt-2 border-t border-[#D4B896]/10">
            <AskMaia
              key={tab}
              tradition="I Ching"
              subject={askMaia.subject}
              aspect={TABS.find((t) => t.id === tab)?.label}
              {...explorerFieldText(entry, tab)}
            />
          </div>
        )}
      </div>
    </section>
  );
}
