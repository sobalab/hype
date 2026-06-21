"use client";

import { useEffect, useMemo, useState } from "react";
import { Reorder, useDragControls, useReducedMotion } from "framer-motion";

import { Icon } from "@/components/icon";
import { SPRING } from "@/components/motion/easing";
import { StoryTag, Team } from "@/lib/data";

// Local copies of the gap-chart color math (three similar lines beat a shared
// abstraction here; both files own their own scope-interpolation).
const TAG_RGB: Record<StoryTag, [number, number, number]> = {
  overhyped: [0xf9, 0x95, 0xb6],
  underhyped: [0x66, 0xe7, 0xd8],
  as_expected: [0xef, 0xec, 0xaf],
  noise: [0xb4, 0xb4, 0xef],
};
type RGB = [number, number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(lerp(a[0], b[0], t)),
  Math.round(lerp(a[1], b[1], t)),
  Math.round(lerp(a[2], b[2], t)),
];

type Props = {
  /** The currently-filtered set the user is ranking. */
  teams: Team[];
  /** Current scope (0 = tournament, 1 = season) defines the truth order. */
  scope: number;
  onExit: () => void;
};

// Predict mode: the user drags the filtered teams into the order they think
// the gap ranks them (most overhyped at top, most underhyped at bottom), locks
// it in, and the list resorts to the truth on a spring while the real gaps
// flood in. The displacement between guess and truth is their miss.
export function GapPredict({ teams, scope, onExit }: Props) {
  const reduce = useReducedMotion();

  const gapAt = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of teams) m.set(t.team, Math.round(lerp(t.gap, t.season_gap, scope)));
    return m;
  }, [teams, scope]);

  const colorAt = (t: Team): string => {
    const [r, g, b] = lerpRGB(TAG_RGB[t.story_tag], TAG_RGB[t.season_story_tag], scope);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const byName = useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.team, t);
    return m;
  }, [teams]);

  // Truth: ascending gap (overhyped first), matching the live chart's sort.
  const trueOrder = useMemo(
    () =>
      [...teams]
        .sort((a, b) => (gapAt.get(a.team)! - gapAt.get(b.team)!))
        .map((t) => t.team),
    [teams, gapAt],
  );

  // Neutral starting order that leaks no gap information: by seed, then name.
  const neutralOrder = useMemo(
    () =>
      [...teams]
        .sort((a, b) => a.seed - b.seed || a.team.localeCompare(b.team))
        .map((t) => t.team),
    [teams],
  );

  const maxGap = useMemo(() => {
    let m = 1;
    for (const v of gapAt.values()) m = Math.max(m, Math.abs(v));
    return m;
  }, [gapAt]);

  const [order, setOrder] = useState<string[]>(neutralOrder);
  const [revealed, setRevealed] = useState(false);

  // If the filtered set changes (filters edited mid-predict), restart cleanly.
  useEffect(() => {
    setOrder(neutralOrder);
    setRevealed(false);
  }, [neutralOrder]);

  const displayOrder = revealed ? trueOrder : order;

  const score = useMemo(() => {
    const truthIndex = new Map(trueOrder.map((n, i) => [n, i]));
    let miss = 0;
    order.forEach((n, i) => {
      miss += Math.abs(i - (truthIndex.get(n) ?? i));
    });
    const n = order.length;
    const maxMiss = Math.max(1, Math.floor((n * n) / 2));
    const acc = Math.max(0, Math.round((1 - miss / maxMiss) * 100));
    return { miss, acc };
  }, [order, trueOrder]);

  const move = (name: string, dir: -1 | 1) => {
    if (revealed) return;
    setOrder((prev) => {
      const i = prev.indexOf(name);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  return (
    <div className="rounded-[14px] border border-core-bright/40 bg-bg-1">
      {/* Control bar */}
      <div className="flex flex-col gap-3 border-b border-border bg-black/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[13px] font-black uppercase tracking-[0.1em] text-core-bright">
            {revealed ? "The truth" : "Make your call"}
          </span>
          <span className="font-mono text-[11px] tracking-[0.06em] text-ink-2">
            {revealed
              ? "Your guess slid to where the gap actually ranks each team."
              : "Drag teams into your predicted gap order, then lock it in."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {revealed ? (
            <>
              <button
                type="button"
                onClick={() => setRevealed(false)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-1 font-display text-[12px] font-black uppercase tracking-[0.1em] text-ink-1 transition-colors hover:border-border-hi hover:text-ink"
              >
                Edit guess
              </button>
              <button
                type="button"
                onClick={onExit}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-core-bright/50 bg-[rgba(18,119,222,0.16)] px-3 py-1 font-display text-[12px] font-black uppercase tracking-[0.1em] text-core-bright transition-colors hover:bg-[rgba(18,119,222,0.26)]"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onExit}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-1 font-display text-[12px] font-black uppercase tracking-[0.1em] text-ink-1 transition-colors hover:border-border-hi hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-core-bright/50 bg-[rgba(18,119,222,0.16)] px-3 py-1 font-display text-[12px] font-black uppercase tracking-[0.1em] text-core-bright transition-colors hover:bg-[rgba(18,119,222,0.26)]"
              >
                <Icon name="bullet" size={6} className="inline-block" />
                Lock it in
              </button>
            </>
          )}
        </div>
      </div>

      {/* Score (revealed only) */}
      {revealed && (
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border px-4 py-3 sm:px-6">
          <span className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-ink">
              {score.acc}%
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2">
              accuracy
            </span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-core-bright">
              {score.miss}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2">
              total rank miss
            </span>
          </span>
        </div>
      )}

      {/* Top / bottom orientation hint */}
      <div className="flex items-center justify-between px-4 pt-3 font-mono text-[11px] uppercase tracking-[0.12em] sm:px-6">
        <span className="text-overhyped">↑ Most overhyped</span>
        <span className="text-underhyped">Most underhyped ↓</span>
      </div>

      <Reorder.Group
        as="div"
        axis="y"
        values={displayOrder}
        onReorder={revealed ? () => {} : setOrder}
        className="flex flex-col gap-1.5 px-3 py-3 sm:px-5"
      >
        {displayOrder.map((name, idx) => {
          const t = byName.get(name);
          if (!t) return null;
          const gap = gapAt.get(name) ?? 0;
          const color = colorAt(t);
          const guessRank = order.indexOf(name);
          const delta = guessRank - idx; // + means it rose toward the top on reveal
          const widthPct = (Math.abs(gap) / maxGap) * 100;
          return (
            <PredictRow
              key={name}
              name={name}
              idx={idx}
              team={t}
              gap={gap}
              color={color}
              widthPct={widthPct}
              delta={delta}
              revealed={revealed}
              reduce={!!reduce}
              onMove={move}
            />
          );
        })}
      </Reorder.Group>
    </div>
  );
}

// One draggable row. Drag is bound to the grip handle only (via dragControls),
// so touching anywhere else on the row scrolls the list instead of dragging.
function PredictRow({
  name,
  idx,
  team: t,
  gap,
  color,
  widthPct,
  delta,
  revealed,
  reduce,
  onMove,
}: {
  name: string;
  idx: number;
  team: Team;
  gap: number;
  color: string;
  widthPct: number;
  delta: number;
  revealed: boolean;
  reduce: boolean;
  onMove: (name: string, dir: -1 | 1) => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={name}
      dragListener={false}
      dragControls={controls}
      transition={reduce ? { duration: 0 } : SPRING}
      tabIndex={revealed ? -1 : 0}
      role={revealed ? undefined : "button"}
      aria-label={
        revealed ? undefined : `${name}, position ${idx + 1}. Use arrow up or down to move.`
      }
      onKeyDown={(e) => {
        if (revealed) return;
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onMove(name, -1);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onMove(name, 1);
        }
      }}
      className={`relative flex min-h-12 select-none items-center gap-3 overflow-hidden rounded-lg border px-3 py-2 ${
        revealed
          ? "border-border bg-[rgba(255,255,255,0.02)]"
          : "border-border-hi bg-[rgba(255,255,255,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-bright/60"
      }`}
    >
      {/* Revealed: a colored gap meter floods in behind the row. */}
      {revealed && (
        <div
          aria-hidden
          className="viz-grow-x absolute inset-y-0 left-0 -z-px"
          style={{
            width: `${widthPct}%`,
            background: `linear-gradient(90deg, ${color}22, ${color}05)`,
            transformOrigin: "left",
            animationDelay: `${Math.min(idx * 18, 700)}ms`,
          }}
        />
      )}

      <span className="relative z-[1] w-6 shrink-0 text-center font-mono text-sm font-bold tabular-nums text-ink-2">
        {idx + 1}
      </span>

      {!revealed && (
        <Icon name="bullet" size={6} className="relative z-[1] shrink-0 text-ink-3" />
      )}

      <span className="relative z-[1] hidden w-7 shrink-0 font-mono text-xs font-semibold tabular-nums text-core-bright sm:inline">
        {String(t.seed).padStart(2, "0")}
      </span>

      <span className="relative z-[1] min-w-0 flex-1 truncate font-sans text-sm text-ink">
        {t.team}
      </span>

      {revealed && (
        <>
          <span
            className="relative z-[1] inline-flex min-w-[34px] shrink-0 items-center justify-center rounded-full border px-1.5 py-px font-mono text-xs font-bold tabular-nums"
            style={{ borderColor: `${color}66`, color }}
          >
            {gap > 0 ? `+${gap}` : gap}
          </span>
          <span
            className={`relative z-[1] w-12 shrink-0 text-right font-mono text-xs tabular-nums ${
              delta === 0 ? "text-underhyped" : "text-ink-2"
            }`}
          >
            {delta === 0 ? "exact" : delta > 0 ? `↑${delta}` : `↓${-delta}`}
          </span>
        </>
      )}

      {/* Grip handle — the only drag affordance. Touch-action:none lets it claim
          the touch for dragging; the rest of the row keeps native scrolling. */}
      {!revealed && (
        <span
          aria-hidden
          onPointerDown={(e) => controls.start(e)}
          style={{ touchAction: "none" }}
          className="relative z-[1] -mr-1 flex shrink-0 cursor-grab items-center self-stretch px-2 font-mono text-base leading-none text-ink-3 transition-colors hover:text-ink-1 active:cursor-grabbing"
        >
          ⠿
        </span>
      )}
    </Reorder.Item>
  );
}
