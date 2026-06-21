"use client";

import { useState, type ReactNode } from "react";

import { GapPredict } from "@/components/gap-predict";
import { Icon } from "@/components/icon";
import { SpectrumCurrent } from "@/components/spectrum-current";
import { AnimatedListReorder, AnimatedRow } from "@/components/motion";
import { useReveal } from "@/components/motion/use-reveal";
import { StoryTag, Team } from "@/lib/data";

// RGB triples (not hex) so the morph can interpolate channel-by-channel and the
// row can build rgba() strings at any alpha.
const TAG_RGB: Record<StoryTag, [number, number, number]> = {
  overhyped: [0xf9, 0x95, 0xb6],
  underhyped: [0x66, 0xe7, 0xd8],
  as_expected: [0xef, 0xec, 0xaf],
  noise: [0xb4, 0xb4, 0xef],
};

type RGB = [number, number, number];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

type Props = {
  teams: Team[];
  maxAbsGap: number;
  /** 0 = tournament, 1 = season. Each bar interpolates between its two ends. */
  scope: number;
  onScopeChange: (v: number) => void;
  /** Inline filter strip, rendered under the header (above the chart). */
  filterBar?: ReactNode;
  selectedTeam: string | null;
  onSelect: (team: Team) => void;
};

export function GapChart({
  teams,
  maxAbsGap,
  scope,
  onScopeChange,
  filterBar,
  selectedTeam,
  onSelect,
}: Props) {
  // Staggered entrance on mount / route navigation. Window covers the last
  // row's (delay + animation); after it closes, filter/scope changes re-render
  // without re-animating.
  const revealing = useReveal(1500);
  const [predicting, setPredicting] = useState(false);

  // Interpolate each team's gap between its tournament and season ends, then
  // sort by the live value so the list reorders as the scope is scrubbed.
  const rows = teams
    .map((t) => {
      const gapNow = Math.round(lerp(t.gap, t.season_gap, scope));
      return {
        team: t,
        gapNow,
        color: lerpRGB(TAG_RGB[t.story_tag], TAG_RGB[t.season_story_tag], scope),
      };
    })
    .sort((a, b) => a.gapNow - b.gapNow);

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-24 text-center text-base text-ink-2 sm:px-7">
        No teams match the current filters.
      </div>
    );
  }

  return (
    <section
      className="relative mx-auto max-w-[1180px]"
      style={{
        padding:
          "clamp(2.5rem, 6vw, 4.5rem) clamp(1.25rem, 4vw, 2rem) clamp(3rem, 7vw, 5rem)",
      }}
    >
      {/* Centered web3 intro — eyebrow + headline + stat centered; the
          instructional caption stays left-aligned inside a centered block. */}
      <header className="mb-12 flex flex-col items-center gap-8 text-center md:mb-16 md:gap-9">
        <div>
          <div className="mb-4 flex items-center justify-center gap-2 font-mono text-sm uppercase tracking-[0.14em] text-ink-2">
            <span className="text-core-bright">01</span>
            <span aria-hidden className="leading-none text-ink-3">·</span>
            <span className="text-ink-1">The Diverging Gap</span>
          </div>
          <h2
            className="m-0 mx-auto max-w-[720px] font-display font-bold leading-[1.4em] tracking-[-0.01em] text-ink"
            style={{ fontSize: "clamp(24px, 3vw, 38px)" }}
          >
            The biggest gaps between{" "}
            <span className="text-core-bright">attention</span> and{" "}
            <span className="text-core-bright">outcome</span>.
          </h2>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex items-baseline gap-2.5">
            <span
              className="font-display font-bold leading-none text-ink"
              style={{ fontSize: "clamp(26px, 4.5vw, 36px)" }}
            >
              {rows.length}
            </span>
            <span className="font-mono text-sm uppercase tracking-[0.16em] text-ink-2">
              Teams
            </span>
          </div>
          <p className="m-0 max-w-md text-left text-base leading-[1.6] text-[#D7EBFF]">
            Left = overhyped. Right = underhyped. Tap any row to expand team
            details.
          </p>
        </div>

        {!predicting && (
          <button
            type="button"
            onClick={() => setPredicting(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-core-bright/45 bg-[rgba(18,119,222,0.12)] px-3.5 py-2 font-display text-[12px] font-black uppercase tracking-[0.1em] text-core-bright transition-colors hover:bg-[rgba(18,119,222,0.2)]"
          >
            <Icon name="bullet" size={6} className="inline-block" />
            Predict the order
          </button>
        )}

        {!predicting && (
          /* Color legend — centered inline row. */
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-[10px] border border-border bg-[rgba(255,255,255,0.025)] px-4 py-2.5">
            <LegendItem color="var(--overhyped)" label="Overhyped" />
            <LegendItem color="var(--noise)" label="Noise" />
            <LegendItem color="var(--as-expected)" label="As expected" />
            <LegendItem color="var(--underhyped)" label="Underhyped" />
          </div>
        )}
      </header>

      {!predicting && filterBar}

      {!predicting && (
        /* Scope morph — sits below the filters, directly above the chart, so
           dragging from tournament to season flows every bar in place. */
        <div className="mb-6 md:mb-8">
          <ScopeSlider value={scope} onChange={onScopeChange} />
        </div>
      )}

      {predicting && (
        <GapPredict
          teams={teams}
          scope={scope}
          onExit={() => setPredicting(false)}
        />
      )}

      {/* Chart frame — flat dark surface, no radial aurora glows. */}
      {!predicting && (
      <div className="relative overflow-hidden rounded-[14px] border border-border bg-bg-1">

        {/* Electric current running the spectrum (additive 2D overlay). */}
        <SpectrumCurrent />

        {/* Axis label row.
            Mobile (<480px): compact 3-col with abbreviated arrow labels.
            sm+ (≥480px): full labels. */}
        <div className="relative z-[2] grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-black/30 px-3 py-3 font-mono text-sm uppercase tracking-[0.12em] text-ink-1 backdrop-blur sm:gap-4 sm:px-6 sm:tracking-[0.16em]">
          <div className="flex items-center justify-between gap-2">
            <span className="ml-1 text-ink-2 sm:ml-2">−{maxAbsGap}</span>
            <span className="inline-flex items-center gap-1.5 text-right font-sans font-bold text-overhyped">
              <Icon name="left-arrow" size={11} />
              <span className="hidden sm:inline">OVERHYPED</span>
              <span className="sm:hidden">OVER</span>
            </span>
          </div>
          <div className="whitespace-nowrap rounded-full border border-border-hi bg-[rgba(18,119,222,0.12)] px-3 py-1 font-mono text-sm tracking-[0.12em] text-core-bright sm:px-3.5 sm:tracking-[0.16em]">
            0<span className="hidden sm:inline"> ZERO GAP</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-sans font-bold text-underhyped">
              <span className="hidden sm:inline">UNDERHYPED</span>
              <span className="sm:hidden">UNDER</span>
              <Icon name="right-arrow" size={11} />
            </span>
            <span className="mr-1 text-ink-2 sm:mr-2">+{maxAbsGap}</span>
          </div>
        </div>

        {/* Center axis line */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[58px] bottom-0 z-[2] w-px"
          style={{
            background:
              "linear-gradient(180deg, transparent, var(--border-hi) 10%, var(--border-hi) 90%, transparent)",
          }}
        />

        {/* Rows — tightly stacked (gap-px) so the diverging bars read as one
            continuous pyramid shape. AnimatedListReorder springs each row to
            its new slot when the scope scrub re-sorts the list. */}
        <AnimatedListReorder
          id="gap-rows"
          className="relative z-[1] flex flex-col gap-px px-3 py-3 sm:px-6 sm:py-4"
        >
          {rows.map((r, i) => {
            const widthPct = (Math.abs(r.gapNow) / maxAbsGap) * 100;
            return (
              <AnimatedRow key={r.team.team} hoverLift={false}>
                <DivRow
                  team={r.team}
                  gapNow={r.gapNow}
                  widthPct={widthPct}
                  isOver={r.gapNow < 0}
                  color={r.color}
                  isSel={selectedTeam === r.team.team}
                  onSelect={onSelect}
                  revealDelay={revealing ? Math.min(i * 13, 720) : null}
                />
              </AnimatedRow>
            );
          })}
        </AnimatedListReorder>
      </div>
      )}

    </section>
  );
}

function ScopeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = Math.round(value * 100);
  const caption =
    value <= 0.02
      ? "15-day hype window vs. tournament wins"
      : value >= 0.98
        ? "Full-season hype vs. season win %"
        : `Blending ${100 - pct}% tournament / ${pct}% season`;
  return (
    <div className="flex w-full flex-col gap-2.5 rounded-[10px] border border-border bg-[rgba(255,255,255,0.025)] px-4 py-3">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.12em]">
        <span className={value < 0.5 ? "text-core-bright" : "text-ink-2"}>
          Tournament
        </span>
        <span className="text-ink-3">Scope</span>
        <span className={value >= 0.5 ? "text-core-bright" : "text-ink-2"}>
          Season
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Scope: drag from tournament to season"
        aria-valuetext={caption}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-core-bright"
        style={{
          background: `linear-gradient(90deg, var(--core) ${pct}%, var(--border-hi) ${pct}%)`,
        }}
      />
      <div className="font-mono text-[11px] tracking-[0.08em] text-ink-2">
        {caption}
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2" style={{ color }}>
      <Icon name="bullet" size={14} color={color} className="block shrink-0" />
      <span className="font-mono text-xs uppercase tracking-[0.12em]">
        {label}
      </span>
    </span>
  );
}

type RowProps = {
  team: Team;
  /** Interpolated, rounded gap shown in the pill. */
  gapNow: number;
  widthPct: number;
  isOver: boolean;
  color: RGB;
  isSel: boolean;
  onSelect: (t: Team) => void;
  /** ms delay for the entrance animation, or null when not revealing. */
  revealDelay: number | null;
};

function DivRow({ team, gapNow, widthPct, isOver, color, isSel, onSelect, revealDelay }: RowProps) {
  const [r, g, b] = color;
  const rgba = (a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;
  const solid = `rgb(${r}, ${g}, ${b})`;
  const animate = revealDelay != null;
  const delayStyle = animate ? { animationDelay: `${revealDelay}ms` } : undefined;
  return (
    <button
      type="button"
      onClick={() => onSelect(team)}
      style={delayStyle}
      className={`group relative grid min-h-[26px] w-full grid-cols-2 items-stretch border-0 bg-transparent p-0 transition-colors pointer-coarse:min-h-[40px] ${
        animate ? "viz-fade" : ""
      } ${
        isSel ? "bg-[rgba(114,184,255,0.06)]" : "hover:bg-[rgba(255,255,255,0.025)]"
      }`}
    >
      {/* LEFT half (overhyped):
          [SEED] [TEAM left-aligned next to seed] ........ [GAP_PILL near-center] */}
      <div className="relative h-full">
        {isOver && (
          <>
            <div
              className={`absolute right-0 top-px bottom-px rounded-l-sm transition-all ${
                animate ? "viz-grow-x" : ""
              }`}
              style={{
                width: `${widthPct}%`,
                background: `linear-gradient(90deg, ${rgba(0.08)}, ${rgba(0.33)} 70%, ${solid})`,
                boxShadow: isSel
                  ? `inset 0 0 0 1px ${rgba(0.8)}`
                  : `inset 0 0 0 1px ${rgba(0.4)}`,
                ...(animate
                  ? { transformOrigin: "right", animationDelay: `${revealDelay}ms` }
                  : null),
              }}
            />
            <div className="absolute inset-y-0 left-2 right-1.5 z-[3] flex items-center gap-2 md:left-3 md:right-2 md:gap-2.5">
              <span className="hidden shrink-0 font-mono text-xs font-semibold tabular-nums text-core-bright sm:inline">
                {String(team.seed).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 truncate text-left font-sans text-[13px] font-medium tracking-[0.01em] text-ink md:text-sm">
                {team.team}
              </span>
              <span
                className="inline-flex min-w-[32px] shrink-0 items-center justify-center rounded-full border bg-[rgba(10,10,12,0.85)] px-1.5 py-px font-mono text-xs font-bold tabular-nums tracking-[0.02em] shadow-[0_1px_6px_rgba(0,0,0,0.5)]"
                style={{
                  borderColor: rgba(0.4),
                  color: solid,
                  textShadow: "0 0 10px currentColor",
                }}
              >
                {gapNow}
              </span>
            </div>
          </>
        )}
      </div>

      {/* RIGHT half (underhyped) — mirror:
          [GAP_PILL near-center] ........ [TEAM right-aligned next to seed] [SEED] */}
      <div className="relative h-full">
        {!isOver && (
          <>
            <div
              className={`absolute left-0 top-px bottom-px rounded-r-sm transition-all ${
                animate ? "viz-grow-x" : ""
              }`}
              style={{
                width: `${widthPct}%`,
                background: `linear-gradient(270deg, ${rgba(0.08)}, ${rgba(0.33)} 70%, ${solid})`,
                boxShadow: isSel
                  ? `inset 0 0 0 1px ${rgba(0.8)}`
                  : `inset 0 0 0 1px ${rgba(0.4)}`,
                ...(animate
                  ? { transformOrigin: "left", animationDelay: `${revealDelay}ms` }
                  : null),
              }}
            />
            <div className="absolute inset-y-0 left-1.5 right-2 z-[3] flex items-center gap-2 md:left-2 md:right-3 md:gap-2.5">
              <span
                className="inline-flex min-w-[32px] shrink-0 items-center justify-center rounded-full border bg-[rgba(10,10,12,0.85)] px-1.5 py-px font-mono text-xs font-bold tabular-nums tracking-[0.02em] shadow-[0_1px_6px_rgba(0,0,0,0.5)]"
                style={{
                  borderColor: rgba(0.4),
                  color: solid,
                  textShadow: "0 0 10px currentColor",
                }}
              >
                +{gapNow}
              </span>
              <span className="min-w-0 flex-1 truncate text-right font-sans text-[13px] font-medium tracking-[0.01em] text-ink md:text-sm">
                {team.team}
              </span>
              <span className="hidden shrink-0 font-mono text-xs font-semibold tabular-nums text-core-bright sm:inline">
                {String(team.seed).padStart(2, "0")}
              </span>
            </div>
          </>
        )}
      </div>
    </button>
  );
}
