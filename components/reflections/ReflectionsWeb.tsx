'use client';

/**
 * ReflectionsWeb — the Web view of the Reflections room (Life Web step 1).
 *
 * Contract: docs/design/contracts/reflections-room.md, addendum 2026-11-26.
 * Design:   docs/programme/REFLECTIONS_LIFE_WEB_DESIGN_2026-11-25.md (§2.2, §6 step 1).
 *
 * A read-only time river of the member's own kept Reflections. Position is the date kept,
 * lane is where it came from, colour is the existing elemental cue. Threads are drawn only
 * where the member already carried a Reflection into another room (a recorded crossing),
 * and appear on the date that crossing was made. No inferred links, no narrator, no counts,
 * no size by importance. Nothing here writes.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/http/apiBase';
import type { WebNode, WebPayload, WebThread } from '@/lib/reflections/webTypes';
import { SOURCE_ORDER, facetLabel, sourceLabel, toneFor } from '@/lib/reflections/labels';
import styles from '@/app/reflections/reflections-room.module.css';

const DAY = 24 * 60 * 60 * 1000;
const CARRIED_LANE = '__carried';

function dateFor(ms: number) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return narrow;
}

function laneKey(sourceType: string) {
  if (sourceType === 'conversation') return 'chat'; // older capsules use this value
  return (SOURCE_ORDER as readonly string[]).includes(sourceType) ? sourceType : 'note';
}

export default function ReflectionsWeb() {
  const narrow = useNarrow();
  const [data, setData] = useState<WebPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scrub, setScrub] = useState(1000);
  const detailRef = useRef<HTMLElement | null>(null);

  // On a phone the detail sits below a tall river; bring it into view when a gem is chosen.
  useEffect(() => {
    if (narrow && selectedId) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [narrow, selectedId]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await apiFetch('/api/reflections/river');
      if (!response.ok) throw new Error('The Web could not be opened just now');
      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The Web could not be opened just now');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const model = useMemo(() => {
    if (!data || data.nodes.length === 0) return null;
    const times = data.nodes.map((n) => Date.parse(n.createdAt));
    const now = Date.now();
    const start = Math.min(...times, ...data.threads.map((t) => Date.parse(t.createdAt)));
    const span = Math.max(now - start, 7 * DAY);
    const present = new Set(data.nodes.map((n) => laneKey(n.sourceType)));
    const lanes: string[] = SOURCE_ORDER.filter((s) => present.has(s));
    const outThreads = data.threads.filter((t) => t.direction === 'out');
    if (outThreads.length > 0) lanes.push(CARRIED_LANE);
    return { start, span, now, lanes, outThreads };
  }, [data]);

  if (error) {
    return (
      <div className={styles.empty}>
        <p>{error}</p>
        <button type="button" onClick={() => void load()}>Try again</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.loading} aria-label="Opening the Web">
        <span />
        <p>Laying out what you kept…</p>
      </div>
    );
  }

  if (!model) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyMark} aria-hidden="true" />
        <h2>Nothing has been kept here yet.</h2>
        <p>When you keep something, it takes its place on the river.</p>
      </div>
    );
  }

  const { start, span, now, lanes, outThreads } = model;
  const cutoff = start + (span * scrub) / 1000;
  const frac = (ms: number) => Math.min(Math.max((ms - start) / span, 0), 1);

  // Geometry. Horizontal on wide screens, vertical on phones (design §2.2).
  const laneSize = narrow ? 54 : 58;
  const gutter = narrow ? 48 : 128;
  const pad = 26;
  const length = narrow ? Math.max(560, data.nodes.length * 16) : 1000;
  const breadth = lanes.length * laneSize;
  const viewW = narrow ? breadth + 24 : length;
  const viewH = narrow ? length : breadth + gutter / 4 + 34;
  const along = (ms: number) => gutter + frac(ms) * (length - gutter - pad);
  const across = (lane: string) => lanes.indexOf(lane) * laneSize + laneSize / 2 + (narrow ? 12 : 8);
  const point = (ms: number, lane: string) =>
    narrow ? { x: across(lane), y: along(ms) } : { x: along(ms), y: across(lane) };

  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const visibleNodes = data.nodes.filter((n) => Date.parse(n.createdAt) <= cutoff);
  const visibleOut = outThreads.filter((t) => Date.parse(t.createdAt) <= cutoff && nodeById.has(t.reflectionId));
  // The detail follows the scrubber: a Reflection not yet kept at the shown moment is not shown,
  // and only crossings made by then are listed.
  const candidate = selectedId ? nodeById.get(selectedId) : undefined;
  const selected: WebNode | undefined =
    candidate && Date.parse(candidate.createdAt) <= cutoff ? candidate : undefined;
  const selectedThreads: WebThread[] = selected
    ? data.threads.filter((t) => t.reflectionId === selected.id && Date.parse(t.createdAt) <= cutoff)
    : [];

  const select = (id: string) => setSelectedId((current) => (current === id ? null : id));

  return (
    <section className={styles.web} aria-label="Your kept reflections across time">
      <p className={styles.webLine}>Only what you kept, and where you carried it.</p>

      <div className={styles.webRiver} data-orientation={narrow ? 'vertical' : 'horizontal'}>
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          width="100%"
          role="group"
          aria-label="Time river"
          style={narrow ? { maxWidth: viewW * 1.6 } : undefined}
        >
          {/* Lanes */}
          {lanes.map((lane, laneIndex) => {
            const label = lane === CARRIED_LANE ? 'Carried into' : sourceLabel(lane);
            const a = across(lane);
            return narrow ? (
              <g key={lane} className={styles.webLane}>
                <line x1={a} y1={gutter - 8} x2={a} y2={length - pad + 8} />
                {/* Alternate rows so neighbouring lane names never run together on a phone. */}
                <text x={a} y={laneIndex % 2 === 0 ? 12 : 28} textAnchor="middle" className={styles.webLaneLabelVertical}>
                  {label}
                </text>
              </g>
            ) : (
              <g key={lane} className={styles.webLane}>
                <line x1={gutter - 8} y1={a} x2={length - pad + 8} y2={a} />
                <text x={0} y={a + 4}>{label}</text>
              </g>
            );
          })}

          {/* Threads: only member-made crossings out of a Reflection, on the date made. */}
          {visibleOut.map((thread) => {
            const node = nodeById.get(thread.reflectionId)!;
            const from = point(Date.parse(node.createdAt), laneKey(node.sourceType));
            const to = point(Date.parse(thread.createdAt), CARRIED_LANE);
            const bend = narrow
              ? `Q ${(from.x + to.x) / 2 + 18} ${(from.y + to.y) / 2}`
              : `Q ${(from.x + to.x) / 2} ${(from.y + to.y) / 2 - 18}`;
            const lit = selectedId === node.id;
            return (
              <g key={thread.id} className={styles.webThread} data-lit={lit ? 'true' : undefined}>
                <path d={`M ${from.x} ${from.y} ${bend} ${to.x} ${to.y}`} />
                <circle cx={to.x} cy={to.y} r={4.5} />
              </g>
            );
          })}

          {/* Gems: same size for all; colour is provenance only. */}
          {visibleNodes.map((node) => {
            const p = point(Date.parse(node.createdAt), laneKey(node.sourceType));
            const isSelected = node.id === selectedId;
            return (
              <g
                key={node.id}
                className={styles.webGem}
                data-selected={isSelected ? 'true' : undefined}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${node.title}, ${sourceLabel(node.sourceType)}, ${dateFor(Date.parse(node.createdAt))}`}
                onClick={() => select(node.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    select(node.id);
                  }
                }}
                style={{ '--gem-tone': toneFor(node.element) } as React.CSSProperties}
              >
                {/* On a phone the river is scaled down, so the touch area is larger. */}
                <circle cx={p.x} cy={p.y} r={narrow ? 22 : 14} className={styles.webGemHit} />
                <circle cx={p.x} cy={p.y} r={6} className={styles.webGemMark} />
              </g>
            );
          })}
        </svg>
      </div>

      <label className={styles.webScrub}>
        <span>Then</span>
        <input
          type="range"
          min={0}
          max={1000}
          value={scrub}
          onChange={(event) => setScrub(Number(event.target.value))}
          aria-label="Move through time"
          aria-valuetext={scrub === 1000 ? 'Now' : dateFor(cutoff)}
        />
        <span>Now</span>
        <output>{scrub === 1000 ? `Now · from ${dateFor(start)}` : `As it stood on ${dateFor(cutoff)}`}</output>
      </label>

      {outThreads.length === 0 ? (
        <p className={styles.webQuiet}>Threads appear when you carry a reflection into another room.</p>
      ) : null}

      {data.truncated ? (
        <p className={styles.webQuiet}>The river shows your most recent thousand kept reflections.</p>
      ) : null}

      {selected ? (
        <aside ref={detailRef} className={styles.webDetail} aria-live="polite">
          <div className={styles.gemProvenance}>
            <span>{sourceLabel(selected.sourceType)}</span>
            <i aria-hidden="true">·</i>
            <time dateTime={selected.createdAt}>{dateFor(Date.parse(selected.createdAt))}</time>
            {selected.draft ? <span className={styles.draftMark}>Unfinished</span> : null}
          </div>
          <h2>{selected.title}</h2>
          <Link href={`/reflections/${selected.id}?from=web`} className={styles.webReturn}>
            Return to this reflection <b aria-hidden="true">→</b>
          </Link>
          {selectedThreads.length > 0 ? (
            <ul className={styles.webThreads}>
              {selectedThreads.map((thread) => (
                <li key={thread.id}>
                  <span>
                    {thread.direction === 'out'
                      ? `${thread.gesture ?? 'Carried'} · ${dateFor(Date.parse(thread.createdAt))}`
                      : `Kept from ${thread.other ? facetLabel(thread.other.facet) : 'another room'}`}
                  </span>
                  {thread.other ? (
                    <Link href={thread.other.href}>
                      Return to {thread.other.label} <b aria-hidden="true">→</b>
                    </Link>
                  ) : (
                    <em>The other end is no longer available.</em>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}
