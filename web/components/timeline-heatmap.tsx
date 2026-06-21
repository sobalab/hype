"use client";

import { Fragment, type ReactNode, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Icon } from "@/components/icon";
import { useReveal } from "@/components/motion/use-reveal";
import { GapMode, StoryTag, Team } from "@/lib/data";
import { useIsMobile } from "@/lib/use-is-mobile";

const TAG_COLOR: Record<StoryTag, string> = {
  overhyped: "#f995b6",
  underhyped: "#66e7d8",
  as_expected: "#efecaf",
  noise: "#b4b4ef",
};

// Navy → glowing core bright. 9-stop ramp. Lightened low end for legibility
// against the dark page background.
const HEAT_STOPS = [
  "#1a2a40",
  "#1f3554",
  "#264069",
  "#2c5085",
  "#3a6fac",
  "#5093d4",
  "#80c0ff",
  "#a8d4ff",
  "#dceaff",
] as const;

function cellColor(intensity: number): string {
  const idx = Math.min(
    HEAT_STOPS.length - 1,
    Math.floor(intensity * HEAT_STOPS.length)
  );
  return HEAT_STOPS[idx];
}

const MOBILE_WINDOW_SIZE = 5;

type Props = {
  teams: Team[];
  mode: GapMode;
  windowDates: string[];
  maxDailyHype: number;
  selectionSundayDate?: string;
  selectedTeam: string | null;
  onSelect: (team: Team) => void;
  /** Optional control (the 2D/3D lens toggle) rendered in the header. */
  lensToggle?: ReactNode;
  /** Inline filter strip, rendered under the header (above the chart). */
  filterBar?: ReactNode;
};

type Bucket = {
  key: string;
  label: string;
  tooltip: string;
  isAnchor: boolean;
};

type SortKey = "gap" | "hype_rank" | "wins" | "seed" | "team";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "gap", label: "Gap" },
  { key: "hype_rank", label: "Hype" },
  { key: "wins", label: "Wins" },
  { key: "seed", label: "Seed" },
  { key: "team", label: "Team" },
];

const DEFAULT_SELECTION_SUNDAY = "2026-03-15";

const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m, day: d };
}

function shortDayLabel(iso: string) {
  const { month, day } = parseIso(iso);
  return `${MONTHS_SHORT[month - 1]} ${day}`;
}

function fullDayLabel(iso: string) {
  const { year, month, day } = parseIso(iso);
  const weekday = WEEKDAYS_FULL[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday}, ${MONTHS_FULL[month - 1]} ${day}, ${year}`;
}

function compareTeams(a: Team, b: Team, key: SortKey): number {
  switch (key) {
    case "gap":       return a.gap - b.gap;
    case "hype_rank": return a.hype_rank - b.hype_rank;
    case "wins":      return b.wins - a.wins || a.seed - b.seed;
    case "seed":      return a.seed - b.seed || a.team.localeCompare(b.team);
    case "team":      return a.team.localeCompare(b.team);
  }
}

export function TimelineHeatmap({
  teams,
  mode,
  windowDates,
  maxDailyHype,
  selectionSundayDate = DEFAULT_SELECTION_SUNDAY,
  selectedTeam,
  onSelect,
  lensToggle,
  filterBar,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("gap");
  const isMobile = useIsMobile(767);
  const [windowStart, setWindowStart] = useState(0);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => compareTeams(a, b, sortKey)),
    [teams, sortKey]
  );

  const { buckets, valueLookup, globalMax } = useMemo(() => {
    if (mode === "tournament") {
      const bs: Bucket[] = windowDates.map((date) => ({
        key: date,
        label: shortDayLabel(date),
        tooltip: fullDayLabel(date),
        isAnchor: date === selectionSundayDate,
      }));
      const lookup = new Map<string, Map<string, number>>();
      for (const t of teams) {
        const inner = new Map<string, number>();
        for (const d of t.hype_daily) inner.set(d.date, d.value);
        lookup.set(t.team, inner);
      }
      return { buckets: bs, valueLookup: lookup, globalMax: maxDailyHype };
    }

    const sample = teams[0]?.season_hype_daily ?? [];
    const seen = new Set<string>();
    const monthKeys: string[] = [];
    for (const d of sample) {
      const key = d.date.slice(0, 7);
      if (!seen.has(key)) {
        seen.add(key);
        monthKeys.push(key);
      }
    }
    const anchorMonth = selectionSundayDate ? selectionSundayDate.slice(0, 7) : null;
    const bs: Bucket[] = monthKeys.map((key) => {
      const [yStr, mStr] = key.split("-");
      const m = Number(mStr);
      return {
        key,
        label: MONTHS_SHORT[m - 1],
        tooltip: `${MONTHS_FULL[m - 1]} ${yStr}`,
        isAnchor: key === anchorMonth,
      };
    });

    const lookup = new Map<string, Map<string, number>>();
    let max = 0;
    for (const t of teams) {
      const sums = new Map<string, { sum: number; n: number }>();
      for (const d of t.season_hype_daily) {
        const key = d.date.slice(0, 7);
        const cur = sums.get(key) ?? { sum: 0, n: 0 };
        cur.sum += d.value;
        cur.n += 1;
        sums.set(key, cur);
      }
      const inner = new Map<string, number>();
      for (const [key, { sum, n }] of sums) {
        const mean = n > 0 ? sum / n : 0;
        inner.set(key, mean);
        if (mean > max) max = mean;
      }
      lookup.set(t.team, inner);
    }
    return { buckets: bs, valueLookup: lookup, globalMax: max || 1 };
  }, [mode, teams, windowDates, maxDailyHype, selectionSundayDate]);

  const scrubberActive = isMobile && mode === "tournament";
  const maxWindowStart = Math.max(0, buckets.length - MOBILE_WINDOW_SIZE);
  const visibleBuckets = scrubberActive
    ? buckets.slice(windowStart, windowStart + MOBILE_WINDOW_SIZE)
    : buckets;

  // Left-to-right column wipe on mount / route navigation; closes before
  // filter/scope edits so they don't re-trigger the sweep.
  const revealing = useReveal(1100);
  const COL_STEP = 32; // ms between columns
  const tailDelay = visibleBuckets.length * COL_STEP;

  if (sortedTeams.length === 0) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-24 text-center text-base text-ink-2 sm:px-7">
        No teams match the current filters.
      </div>
    );
  }

  return (
    <section
      className="relative mx-auto min-w-0 max-w-[1180px]"
      style={{
        padding:
          "clamp(2.5rem, 6vw, 4.5rem) clamp(1.25rem, 4vw, 2rem) clamp(3rem, 7vw, 5rem)",
      }}
    >
      {/* Centered web3 intro — matches the Divergent template. */}
      <header className="mb-12 flex flex-col items-center gap-8 text-center md:mb-16 md:gap-9">
        <div>
          <div className="mb-4 flex items-center justify-center gap-2 font-mono text-sm uppercase tracking-[0.14em] text-ink-2">
            <span className="text-core-bright">03</span>
            <span aria-hidden className="leading-none text-ink-3">·</span>
            <span className="text-ink-1">The Timeline</span>
          </div>
          <h2
            className="m-0 mx-auto max-w-[760px] font-display font-bold leading-[1.4em] tracking-[-0.01em] text-ink"
            style={{ fontSize: "clamp(24px, 3vw, 38px)" }}
          >
            Which teams peaked{" "}
            <span className="text-core-bright">early</span>. Which ones peaked
            at the <span className="text-core-bright">buzzer</span>.
          </h2>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-baseline gap-2.5">
            <span
              className="font-display font-bold leading-none text-ink"
              style={{ fontSize: "clamp(26px, 4.5vw, 36px)" }}
            >
              {sortedTeams.length}
            </span>
            <span className="font-mono text-sm uppercase tracking-[0.16em] text-ink-2">
              Teams
            </span>
          </div>
          <p className="m-0 max-w-md text-left text-base leading-[1.6] text-[#D7EBFF]">
            One row per team, one column per{" "}
            {mode === "season" ? "month" : "day"}. Watch where the heat lands.
          </p>
        </div>

        {lensToggle}

        {/* Sort */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-mono text-sm uppercase tracking-[0.18em] text-ink-3">
            SORT
          </span>
          <div className="inline-flex w-fit max-w-full flex-wrap justify-center rounded-[10px] border border-border bg-[rgba(255,255,255,0.025)] p-[3px]">
            {SORT_OPTIONS.map((opt) => {
              const active = sortKey === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSortKey(opt.key)}
                  aria-pressed={active}
                  className={`inline-flex min-h-11 items-center rounded-[7px] px-3 py-1 font-mono text-sm uppercase tracking-[0.06em] transition-all ${
                    active
                      ? "bg-[rgba(255,255,255,0.08)] text-ink"
                      : "text-ink-1 hover:text-ink"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {filterBar}

      {scrubberActive && (
        <div className="mb-3 flex items-center gap-3 sm:hidden">
          <button
            type="button"
            onClick={() => setWindowStart((s) => Math.max(0, s - 1))}
            disabled={windowStart === 0}
            aria-label="Previous day"
            className="rounded-full border border-border p-1.5 text-ink-2 disabled:opacity-30"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <div className="flex-1 text-center font-mono text-sm uppercase tabular-nums text-ink">
            {visibleBuckets.length > 0 &&
              `${visibleBuckets[0].label} – ${visibleBuckets[visibleBuckets.length - 1].label}`}
          </div>
          <button
            type="button"
            onClick={() => setWindowStart((s) => Math.min(maxWindowStart, s + 1))}
            disabled={windowStart >= maxWindowStart}
            aria-label="Next day"
            className="rounded-full border border-border p-1.5 text-ink-2 disabled:opacity-30"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}

      {/* Color scale — above the heatmap */}
      <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-2">
          INTENSITY
        </span>
        <div className="inline-flex items-center gap-1">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            LOW
          </span>
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="h-3 rounded-[2px]"
              style={{ background: cellColor(i / 8), width: 22 }}
            />
          ))}
          <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            PEAK
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-bg-1">
        <div className="w-full overflow-x-auto overscroll-x-contain">
          <div
            className="grid min-w-[680px]"
            style={{
              gridTemplateColumns: `200px repeat(${visibleBuckets.length}, minmax(28px, 1fr)) 60px`,
            }}
          >
            {/* Header row */}
            <div className="flex items-center bg-black/40 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-2">
              TEAM
            </div>
            {visibleBuckets.map((b, i) => (
              <div
                key={`hdr-${b.key}`}
                title={b.isAnchor ? `${b.tooltip} (Selection Sunday)` : b.tooltip}
                className={`flex items-center justify-center bg-black/40 px-1 py-2 font-mono text-[9px] uppercase tracking-[0.06em] ${
                  revealing ? "viz-fade" : ""
                }`}
                style={{
                  color: b.isAnchor ? "var(--core-bright)" : "var(--ink-2)",
                  borderLeft: b.isAnchor ? "1px solid rgba(114,184,255,0.6)" : undefined,
                  marginLeft: i === 0 ? undefined : 0,
                  ...(revealing ? { animationDelay: `${i * COL_STEP}ms` } : null),
                }}
              >
                {b.label}
              </div>
            ))}
            <div className="flex items-center justify-center border-l border-border bg-black/40 font-mono text-[10px] text-ink-2">
              ±
            </div>

            {/* Body rows */}
            {sortedTeams.map((t) => {
              const isSel = selectedTeam === t.team;
              const inner = valueLookup.get(t.team);
              return (
                <Fragment key={t.team}>
                  <button
                    type="button"
                    onClick={() => onSelect(t)}
                    style={revealing ? { animationDelay: "0ms" } : undefined}
                    className={`flex min-h-11 items-center gap-2 px-3.5 py-1 text-left transition ${
                      revealing ? "viz-fade" : ""
                    } ${
                      isSel ? "bg-[rgba(114,184,255,0.06)]" : "bg-transparent"
                    }`}
                  >
                    <span className="font-mono text-sm tabular-nums text-core-bright">
                      {String(t.seed).padStart(2, "0")}
                    </span>
                    <span className="truncate font-sans text-sm text-ink">
                      {t.team}
                    </span>
                  </button>
                  {visibleBuckets.map((b, bi) => {
                    const value = inner?.get(b.key) ?? 0;
                    const intensity = Math.min(1, value / globalMax);
                    const bg = cellColor(intensity);
                    return (
                      <button
                        key={`${t.team}-${b.key}`}
                        type="button"
                        onClick={() => onSelect(t)}
                        title={`${t.team}, ${b.tooltip}, ${value.toFixed(1)}`}
                        className={`transition hover:opacity-80 ${
                          revealing ? "viz-fade" : ""
                        }`}
                        style={{
                          backgroundColor: bg,
                          boxShadow:
                            intensity > 0.75 ? `0 0 12px ${bg}99` : "none",
                          margin: "4px 3px",
                          borderRadius: 7,
                          minHeight: 36,
                          ...(revealing
                            ? { animationDelay: `${bi * COL_STEP}ms` }
                            : null),
                        }}
                        aria-label={`${t.team}, ${b.tooltip}: ${value.toFixed(1)}`}
                      />
                    );
                  })}
                  <div
                    className={`flex min-h-11 items-center justify-center border-l border-border bg-transparent font-mono text-sm font-bold tabular-nums ${
                      revealing ? "viz-fade" : ""
                    }`}
                    style={{
                      color: TAG_COLOR[t.story_tag],
                      ...(revealing ? { animationDelay: `${tailDelay}ms` } : null),
                    }}
                  >
                    {t.gap > 0 ? `+${t.gap}` : t.gap}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

    </section>
  );
}
