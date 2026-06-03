"use client";

import { Icon } from "@/components/icon";
import { StoryTag, Team } from "@/lib/data";

const TAG_COLOR: Record<StoryTag, string> = {
  overhyped: "#f995b6",
  underhyped: "#66e7d8",
  as_expected: "#efecaf",
  noise: "#b4b4ef",
};

type Props = {
  teams: Team[];
  maxAbsGap: number;
  selectedTeam: string | null;
  onSelect: (team: Team) => void;
};

export function GapChart({ teams, maxAbsGap, selectedTeam, onSelect }: Props) {
  const sorted = [...teams].sort((a, b) => a.gap - b.gap);

  if (sorted.length === 0) {
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
      <header className="mb-10 flex flex-col gap-10 md:mb-12 md:gap-12">
        <div>
          <div className="mb-4 flex items-center gap-2 font-mono text-sm uppercase tracking-[0.14em] text-ink-2">
            <span className="text-core-bright">01</span>
            <span aria-hidden className="leading-none text-ink-3">/</span>
            <span className="text-ink-1">The Diverging Gap</span>
          </div>
          <h2
            className="m-0 max-w-[720px] font-display font-bold leading-[1.4em] tracking-[-0.01em] text-ink"
            style={{ fontSize: "clamp(22px, 2.6vw, 34px)" }}
          >
            The biggest gaps between{" "}
            <span className="text-core-bright">attention</span> and{" "}
            <span className="text-core-bright">outcome</span>.
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2.5">
            <span
              className="font-display font-bold leading-none text-ink"
              style={{ fontSize: "clamp(26px, 4.5vw, 36px)" }}
            >
              {sorted.length}
            </span>
            <span className="font-mono text-sm uppercase tracking-[0.16em] text-ink-2">
              Teams
            </span>
          </div>
          <p className="m-0 max-w-md text-base leading-[1.6] text-[#D7EBFF]">
            Left = overhyped. Right = underhyped. Tap any row to expand team
            details.
          </p>
        </div>

        {/* Color legend — vertical stack on mobile, full-width row on sm+. */}
        <div className="flex w-full flex-col items-start gap-3 rounded-[10px] border border-border bg-[rgba(255,255,255,0.025)] px-3.5 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
          <LegendItem color="var(--overhyped)" label="Overhyped" />
          <LegendItem color="var(--noise)" label="Noise" />
          <LegendItem color="var(--as-expected)" label="As expected" />
          <LegendItem color="var(--underhyped)" label="Underhyped" />
        </div>
      </header>

      {/* Chart frame — flat dark surface, no radial aurora glows. */}
      <div className="relative overflow-hidden rounded-[14px] border border-border bg-bg-1">

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
            continuous pyramid shape, condensing 68 teams into ~half the height. */}
        <div className="relative z-[1] flex flex-col gap-px px-3 py-3 sm:px-6 sm:py-4">
          {sorted.map((t) => {
            const widthPct = (Math.abs(t.gap) / maxAbsGap) * 100;
            return (
              <DivRow
                key={t.team}
                team={t}
                widthPct={widthPct}
                isOver={t.gap < 0}
                color={TAG_COLOR[t.story_tag]}
                isSel={selectedTeam === t.team}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      </div>

    </section>
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
  widthPct: number;
  isOver: boolean;
  color: string;
  isSel: boolean;
  onSelect: (t: Team) => void;
};

function DivRow({ team, widthPct, isOver, color, isSel, onSelect }: RowProps) {
  const gap = team.gap;
  return (
    <button
      type="button"
      onClick={() => onSelect(team)}
      className={`group relative grid min-h-[26px] w-full grid-cols-2 items-stretch border-0 bg-transparent p-0 transition-colors pointer-coarse:min-h-[40px] ${
        isSel ? "bg-[rgba(114,184,255,0.06)]" : "hover:bg-[rgba(255,255,255,0.025)]"
      }`}
    >
      {/* LEFT half (overhyped):
          [SEED] [TEAM left-aligned next to seed] ........ [GAP_PILL near-center] */}
      <div className="relative h-full">
        {isOver && (
          <>
            <div
              className="absolute right-0 top-px bottom-px rounded-l-sm transition-all"
              style={{
                width: `${widthPct}%`,
                background: `linear-gradient(90deg, ${color}14, ${color}55 70%, ${color})`,
                boxShadow: isSel
                  ? `inset 0 0 0 1px ${color}cc`
                  : `inset 0 0 0 1px ${color}66`,
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
                  borderColor: `${color}66`,
                  color,
                  textShadow: "0 0 10px currentColor",
                }}
              >
                {gap}
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
              className="absolute left-0 top-px bottom-px rounded-r-sm transition-all"
              style={{
                width: `${widthPct}%`,
                background: `linear-gradient(270deg, ${color}14, ${color}55 70%, ${color})`,
                boxShadow: isSel
                  ? `inset 0 0 0 1px ${color}cc`
                  : `inset 0 0 0 1px ${color}66`,
              }}
            />
            <div className="absolute inset-y-0 left-1.5 right-2 z-[3] flex items-center gap-2 md:left-2 md:right-3 md:gap-2.5">
              <span
                className="inline-flex min-w-[32px] shrink-0 items-center justify-center rounded-full border bg-[rgba(10,10,12,0.85)] px-1.5 py-px font-mono text-xs font-bold tabular-nums tracking-[0.02em] shadow-[0_1px_6px_rgba(0,0,0,0.5)]"
                style={{
                  borderColor: `${color}66`,
                  color,
                  textShadow: "0 0 10px currentColor",
                }}
              >
                +{gap}
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
