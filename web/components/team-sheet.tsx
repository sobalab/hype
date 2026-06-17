"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/icon";
import { Provenance, ProvInfo } from "@/components/provenance";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Dataset, GapMode, StoryTag, TAG_LABEL, Team } from "@/lib/data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Date-only ("YYYY-MM-DD") formatter that avoids timezone drift.
function fmtDateOnly(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
// Full-ISO timestamp formatter (UTC) for the data_pulled_at stamp.
function fmtStamp(iso: string): string {
  const dt = new Date(iso);
  return `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
}

const TAG_COLOR: Record<StoryTag, string> = {
  overhyped: "#f995b6",
  underhyped: "#66e7d8",
  as_expected: "#efecaf",
  noise: "#b4b4ef",
};

type Props = {
  team: Team | null;
  mode: GapMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hypeWindowStart: string;
  hypeWindowEnd: string;
  meta: Dataset["metadata"];
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

function formatAcceleration(v: number): string {
  if (!Number.isFinite(v) || v < 0) return ",";
  return v < 100 ? `${v.toFixed(1)}×` : `${Math.round(v)}×`;
}

function gapStoryCopy(
  mode: GapMode,
  team: Team,
  active: { hypeRank: number; perfRank: number },
  gap: number
): string {
  if (mode === "season") {
    if (gap > 0) {
      return `Hyped at season rank #${active.hypeRank} but performed at #${active.perfRank} (${team.season_wins}–${team.season_losses}), the internet underrated them by ${Math.abs(gap)} spots.`;
    }
    if (gap < 0) {
      return `Hyped at season rank #${active.hypeRank} but performed at #${active.perfRank} (${team.season_wins}–${team.season_losses}), the internet overrated them by ${Math.abs(gap)} spots.`;
    }
    return `Hyped at season rank #${active.hypeRank}, performed in line. Exactly as expected across the season.`;
  }
  if (gap > 0) {
    return `Hyped at rank #${active.hypeRank} but went ${team.wins}W, the internet underrated them by ${Math.abs(gap)} spots.`;
  }
  if (gap < 0) {
    return `Hyped at rank #${active.hypeRank} but went ${team.wins}W, the internet overrated them by ${Math.abs(gap)} spots.`;
  }
  return `Hyped at rank #${active.hypeRank}, performed in line. Exactly as expected.`;
}

export function TeamSheet({
  team,
  mode,
  open,
  onOpenChange,
  hypeWindowStart,
  hypeWindowEnd,
  meta,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto bg-bg-1 sm:max-w-2xl! sm:overflow-hidden"
      >
        {team && (
          <TeamSheetBody
            team={team}
            mode={mode}
            hypeWindowStart={hypeWindowStart}
            hypeWindowEnd={hypeWindowEnd}
            meta={meta}
          />
        )}
        {!team && (
          <SheetHeader>
            <SheetTitle>Loading…</SheetTitle>
            <SheetDescription>Pick a team to see details.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TeamSheetBody({
  team,
  mode,
  hypeWindowStart,
  hypeWindowEnd,
  meta,
}: {
  team: Team;
  mode: GapMode;
  hypeWindowStart: string;
  hypeWindowEnd: string;
  meta: Dataset["metadata"];
}) {
  // All headline copy reads from `active` so the panel reflects the current
  // mode the user selected in the filter bar. The opposite-mode counterparts
  // surface in the secondary stat grid.
  const active = {
    gap: mode === "season" ? team.season_gap : team.gap,
    storyTag: mode === "season" ? team.season_story_tag : team.story_tag,
    hypeRank: mode === "season" ? team.season_hype_rank : team.hype_rank,
    perfRank:
      mode === "season" ? team.season_performance_rank : team.performance_rank,
    hypeIndex:
      mode === "season" ? team.season_hype_normalized : team.hype_normalized,
  };
  const other = {
    gap: mode === "season" ? team.gap : team.season_gap,
    hypeRank: mode === "season" ? team.hype_rank : team.season_hype_rank,
    perfRank:
      mode === "season" ? team.performance_rank : team.season_performance_rank,
  };
  const color = TAG_COLOR[active.storyTag];
  const seasonDaily =
    team.season_hype_daily.length > 0 ? team.season_hype_daily : team.hype_daily;
  const peak = seasonDaily.reduce(
    (m, d) => (d.value > m.value ? d : m),
    seasonDaily[0]
  );
  const gap = active.gap;
  const modeLabel = mode === "season" ? "Season" : "Tournament";
  const otherModeLabel = mode === "season" ? "Tournament" : "Season";

  // Provenance: trace every headline number back to its source and window.
  const pulled = `Pulled ${fmtStamp(meta.data_pulled_at)}.`;
  const hypeWin = `${fmtDateOnly(meta.hype_window_start)} to ${fmtDateOnly(meta.hype_window_end)}`;
  const seasonWin = `${fmtDateOnly(meta.season_window_start)} to ${fmtDateOnly(meta.season_window_end)}`;
  const year = meta.tournament_year;
  const hypeSource: ProvInfo["lines"] =
    mode === "season"
      ? [
          { k: "Source", v: "Google Trends, daily" },
          { k: "Window", v: seasonWin },
          { k: "Scale", v: "Standalone per team, intra-team only" },
        ]
      : [
          { k: "Source", v: "Google Trends, daily" },
          { k: "Window", v: hypeWin },
          { k: "Scale", v: "Cross-batch normalized vs a reference team" },
        ];
  const prov = {
    wins: {
      label: "Wins",
      lines: [
        { k: "Source", v: `NCAA ${year} tournament results` },
        { k: "Counts", v: "Every bracket win, play-in games included" },
      ],
      note: pulled,
    },
    hypeRank: { label: `${modeLabel} hype rank`, lines: hypeSource, note: pulled },
    hypeIndex: { label: `${modeLabel} hype index`, lines: hypeSource, note: pulled },
    gapActive: {
      label: `${modeLabel} gap`,
      lines: [
        { k: "Formula", v: "Hype rank minus performance rank" },
        { k: "Hype", v: mode === "season" ? `Trends, ${seasonWin}` : `Trends, ${hypeWin}` },
        { k: "Outcome", v: mode === "season" ? "Season win percentage" : "Tournament wins" },
      ],
      note: pulled,
    },
    gapOther: {
      label: `${otherModeLabel} gap`,
      lines: [
        { k: "Formula", v: "Hype rank minus performance rank" },
        { k: "Hype", v: mode === "season" ? `Trends, ${hypeWin}` : `Trends, ${seasonWin}` },
        { k: "Outcome", v: mode === "season" ? "Tournament wins" : "Season win percentage" },
      ],
      note: pulled,
    },
    hypeAccel: {
      label: "Hype acceleration",
      lines: [
        { k: "Formula", v: "In-window mean over pre-tournament mean" },
        { k: "Source", v: "Season hype curve (Trends)" },
      ],
      note: pulled,
    },
    perfRank: {
      label: `${modeLabel} performance rank`,
      lines:
        mode === "season"
          ? [
              { k: "Source", v: "NCAA season standings" },
              { k: "Rank by", v: "Season win percentage" },
            ]
          : [
              { k: "Source", v: `NCAA ${year} results` },
              { k: "Rank by", v: "Tournament wins" },
            ],
      note: pulled,
    },
    seasonWL: {
      label: "Season record",
      lines: [
        { k: "Source", v: "NCAA season standings API" },
        { k: "Note", v: "Overall, includes the tournament" },
      ],
      note: pulled,
    },
    perfAccel: {
      label: "Performance acceleration",
      lines: [
        { k: "Formula", v: "Tournament win rate over pre-tournament win rate" },
      ],
      note: pulled,
    },
  } satisfies Record<string, ProvInfo>;

  return (
    <div
      className="relative isolate flex flex-col gap-5 sm:h-full sm:min-h-0 sm:gap-2.5"
      style={{ padding: "clamp(1.25rem, 4vw, 1.5rem)" }}
    >
      {/* Aurora glow behind */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[400px] opacity-40 blur-[60px]"
        style={{
          background: `radial-gradient(circle, ${color}33, transparent 60%)`,
        }}
      />

      <SheetHeader className="gap-0 p-0 sm:shrink-0">
        <div className="mb-3 font-mono text-[13px] uppercase tracking-[0.18em] text-ink-2 sm:mb-2">
          TEAM DOSSIER
        </div>
        <div className="mb-4 flex items-center gap-4 sm:mb-0">
          <div className="flex flex-col gap-2.5 sm:gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold tabular-nums tracking-[0.06em] text-core-bright">
                #{String(team.seed).padStart(2, "0")}
              </span>
              <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-1">
                {team.region.toUpperCase()} REGION
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.1em]"
                style={{
                  color,
                  borderColor: `${color}55`,
                  background: `${color}11`,
                }}
              >
                <Icon name="bullet" size={9} />
                {TAG_LABEL[active.storyTag]}
              </span>
            </div>
            <SheetTitle
              className="m-0 break-words font-display font-bold leading-tight tracking-[-0.01em] text-ink"
              style={{ fontSize: "clamp(24px, 5vw, 32px)" }}
            >
              {team.team}
            </SheetTitle>
          </div>
        </div>
        <SheetDescription className="sr-only">
          {team.wins} {team.wins === 1 ? "win" : "wins"} in the {team.region} region.
        </SheetDescription>
      </SheetHeader>

      {/* Big gap callout — mode-aware. */}
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.025)] px-5 py-5 sm:shrink-0 sm:px-6 sm:py-3.5">
        <Provenance
          info={prov.gapActive}
          className="mb-2 font-mono text-[13px] uppercase tracking-[0.14em] text-ink-2 sm:mb-1.5"
        >
          {modeLabel} Gap
        </Provenance>
        <div
          className="font-display font-bold leading-none tracking-[-0.02em] tabular-nums"
          style={{
            color,
            textShadow: "0 0 24px currentColor",
            fontSize: "clamp(40px, 6vw, 48px)",
          }}
        >
          {gap > 0 ? `+${gap}` : gap}
        </div>
        <div className="mt-3 max-w-[480px] font-sans text-[15px] leading-[1.45] text-ink-1 sm:mt-2.5">
          {gapStoryCopy(mode, team, active, gap)}
        </div>
      </div>

      {/* Stats + chart. On short desktop viewports (≤850px, the `compact`
          variant) this region becomes a two-column row — stat grid beside the
          chart — so the panel still fits without scrolling. Otherwise (mobile
          and tall desktop) it stacks vertically with the chart filling. */}
      <div className="flex flex-col gap-5 sm:min-h-0 sm:flex-1 sm:gap-2.5 compact:flex-row compact:gap-4">
        {/* Stat grid — 2 cols normally, single column in the compact row so the
            labels fit the narrower column. */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:shrink-0 compact:w-[316px] compact:grid-cols-1 compact:self-start">
        <SheetStat label="Wins" value={String(team.wins)} prov={prov.wins} />
        <SheetStat label={`${modeLabel} hype rank`} value={`#${active.hypeRank}`} prov={prov.hypeRank} />
        <SheetStat
          label={`${modeLabel} hype index`}
          value={active.hypeIndex.toFixed(1)}
          prov={prov.hypeIndex}
        />
        <SheetStat
          label={`${otherModeLabel} gap`}
          value={other.gap > 0 ? `+${other.gap}` : `${other.gap}`}
          prov={prov.gapOther}
        />
        <SheetStat
          label="Hype accel"
          value={formatAcceleration(team.hype_acceleration)}
          prov={prov.hypeAccel}
        />
        <SheetStat label={`${modeLabel} perf rank`} value={`#${active.perfRank}`} prov={prov.perfRank} />
        <SheetStat
          label="Season W–L"
          value={`${team.season_wins}–${team.season_losses}`}
          prov={prov.seasonWL}
        />
        <SheetStat
          label="Perf accel"
          value={formatAcceleration(team.performance_acceleration)}
          prov={prov.perfAccel}
        />
      </div>

        {/* Full season curve */}
        <ChartBlock
          data={seasonDaily}
          color={color}
          peak={peak}
          windowStart={hypeWindowStart}
          windowEnd={hypeWindowEnd}
          team={team}
          showTournamentWindow={mode === "tournament"}
        />
      </div>
    </div>
  );
}

function ChartBlock({
  data,
  color,
  peak,
  windowStart,
  windowEnd,
  team,
  showTournamentWindow,
}: {
  data: { date: string; value: number }[];
  color: string;
  peak: { date: string; value: number };
  windowStart: string;
  windowEnd: string;
  team: Team;
  showTournamentWindow: boolean;
}) {
  const [view, setView] = useState<"area" | "line">("area");
  return (
    <div className="flex flex-col gap-2 pt-4 sm:min-h-0 sm:flex-1 sm:pt-1">
      <div className="flex flex-col items-start gap-2 sm:shrink-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="font-mono text-[13px] uppercase tracking-[0.16em] text-ink-1 sm:text-sm">
          {showTournamentWindow
            ? "FULL SEASON HYPE CURVE"
            : "SEASON HYPE CURVE"}
        </span>
        <div className="inline-flex shrink-0 rounded-md border border-border bg-[rgba(255,255,255,0.025)] p-0.5">
          {(["area", "line"] as const).map((v) => {
            const active = view === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={active}
                className={`min-h-8 rounded-[5px] px-3 py-1 font-mono text-[12px] uppercase tracking-[0.1em] transition-all ${
                  active
                    ? "bg-[rgba(255,255,255,0.06)] text-ink shadow-[inset_0_0_0_1px_var(--border-hi)]"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>
      <Curve
        data={data}
        color={color}
        windowStart={windowStart}
        windowEnd={windowEnd}
        team={team}
        view={view}
        showTournamentWindow={showTournamentWindow}
      />
      <div className="font-mono text-[12px] tracking-[0.1em] text-ink-2 sm:shrink-0">
        peaked {peak.value.toFixed(0)} on {shortDate(peak.date)}
      </div>
    </div>
  );
}

function SheetStat({
  label,
  value,
  prov,
}: {
  label: string;
  value: string;
  prov?: ProvInfo;
}) {
  const labelCls =
    "break-words font-mono text-[12px] uppercase tracking-[0.12em] text-ink-2 sm:tracking-[0.08em] compact:text-[11px] compact:leading-tight compact:tracking-[0.04em]";
  return (
    <div className="bg-bg-1 px-5 py-3.5 sm:px-5 sm:py-2 compact:py-1.5">
      {prov ? (
        <Provenance info={prov} className={labelCls}>
          <span>{label}</span>
        </Provenance>
      ) : (
        <div className={labelCls}>{label}</div>
      )}
      <div className="mt-1.5 font-display text-[22px] font-bold leading-none text-ink sm:mt-1 sm:text-[20px]">
        {value}
      </div>
    </div>
  );
}

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const u = () => setM(mq.matches);
    u();
    mq.addEventListener("change", u);
    return () => mq.removeEventListener("change", u);
  }, []);
  return m;
}

function formatHoverDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${monthShort} ${d}, ${y}`;
}

function Curve({
  data,
  color,
  windowStart,
  windowEnd,
  team,
  view,
  showTournamentWindow,
}: {
  data: { date: string; value: number }[];
  color: string;
  windowStart: string;
  windowEnd: string;
  team: Team;
  view: "area" | "line";
  showTournamentWindow: boolean;
}) {
  const isMobile = useIsMobile();
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);
  // On desktop the chart flexes to fill the leftover sheet height; we measure
  // that height and feed it into the SVG's pixel math so the curve + overlays
  // fit the viewport without scrolling. Mobile keeps a fixed scrollable height.
  const [fluidH, setFluidH] = useState(360);

  // Reserve space for the "Tournament window" badge only when the band is
  // shown (season-mode hides the badge so the chart can sit closer to the
  // toggle above it).
  const topPad = showTournamentWindow ? 28 : 0;

  useEffect(() => {
    if (isMobile) return;
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.clientHeight - topPad;
      if (h > 0) setFluidH(Math.max(135, h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile, topPad]);

  const W = 600;
  const H = isMobile ? 300 : fluidH;
  const PAD_L = 72;
  const PAD_R = 16;
  const PAD_T = 44;
  const PAD_B = 36;

  const max = useMemo(
    () => (data.length === 0 ? 1 : Math.max(1, ...data.map((d) => d.value))),
    [data]
  );

  if (data.length === 0) return null;

  const x = (i: number) =>
    PAD_L + (i / Math.max(1, data.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => H - PAD_B - (v / max) * (H - PAD_T - PAD_B);

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.value)}`)
    .join(" ");
  const fillPath = `${linePath} L ${x(data.length - 1)} ${H - PAD_B} L ${x(0)} ${H - PAD_B} Z`;

  // Tournament-window band — hidden in season mode where the whole chart
  // already represents the season.
  const wStartIdx = showTournamentWindow
    ? data.findIndex((d) => d.date >= windowStart)
    : -1;
  const wEndIdxRaw = showTournamentWindow
    ? data.findIndex((d) => d.date >= windowEnd)
    : -1;
  const wEndIdx = wEndIdxRaw < 0 ? data.length - 1 : wEndIdxRaw;
  const startX = wStartIdx >= 0 ? x(wStartIdx) : null;
  const endX = startX !== null ? x(wEndIdx) : null;

  const gradId = `curve-fill-${team.team.replace(/\W/g, "")}`;

  // y-axis ticks (0, 50, 100 normalized to actual max).
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => p * max);

  // Selected index — pinned wins over hover.
  const activeIdx = pinnedIdx ?? hoverIdx;
  const activePoint = activeIdx != null ? data[activeIdx] : null;

  const handlePointerMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = clientX - rect.left;
    const xVB = (xPx / rect.width) * W;
    const plotX = xVB - PAD_L;
    const plotW = W - PAD_L - PAD_R;
    if (plotW <= 0) return;
    const t = Math.max(0, Math.min(1, plotX / plotW));
    const idx = Math.round(t * (data.length - 1));
    setHoverIdx(idx);
  };

  // Tooltip placement (HTML overlay positioned absolutely within the wrapper).
  // Use percentages so it scales with the SVG.
  const tooltipLeftPct =
    activeIdx != null ? (x(activeIdx) / W) * 100 : null;
  const tooltipTopPct =
    activeIdx != null
      ? (y(data[activeIdx].value) / H) * 100
      : null;

  // Tournament-window label anchor as a percent so it scales with the SVG.
  const windowLabelLeftPct =
    startX !== null ? (startX / W) * 100 : null;

  return (
    <div
      ref={wrapRef}
      className="relative sm:min-h-0 sm:flex-1"
      style={{ paddingTop: topPad }}
    >
      {/* Y-axis tick labels — HTML overlay so text isn't horizontally squished
          by the SVG's preserveAspectRatio="none". The SVG's height is fixed at
          H pixels, so y(v) viewBox-units lines up 1:1 with pixel y-offset
          inside the chart area; we offset by topPad above. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 z-[1]"
        style={{ top: topPad, height: H }}
      >
        {yTicks.map((v, i) => (
          <span
            key={`yl-${i}`}
            className="absolute font-mono text-[11px] leading-none text-ink-2"
            style={{
              top: y(v) - 5,
              left: "10px",
              width: `${(PAD_L / W) * 100}%`,
              textAlign: "right",
              paddingRight: "12px",
            }}
          >
            {Math.round(v)}
          </span>
        ))}
      </div>

      {/* Tournament-window label — HTML overlay above the chart, anchored to
          the band's left edge with clamp() so it never clips. */}
      {windowLabelLeftPct !== null && (
        <div
          className="pointer-events-none absolute top-0 z-[2] inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-core-bright/55 bg-bg-2/95 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-core-bright"
          style={
            // When the band is in the second half of the chart, right-anchor
            // the badge so it never spills past the chart's right edge.
            // Otherwise left-anchor it to the band's start.
            windowLabelLeftPct > 50
              ? { right: "0px" }
              : { left: `${windowLabelLeftPct}%` }
          }
        >
          <Icon name="bullet" size={9} />
          Tournament window
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block w-full rounded-lg border border-border bg-[rgba(255,255,255,0.02)] touch-none"
        style={{ height: H }}
        onMouseMove={(e) => handlePointerMove(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchMove={(e) => {
          if (e.touches.length > 0) handlePointerMove(e.touches[0].clientX);
        }}
        onTouchEnd={() => setHoverIdx(null)}
        onClick={() => {
          if (hoverIdx == null) return;
          setPinnedIdx((p) => (p === hoverIdx ? null : hoverIdx));
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.55" />
            <stop offset="0.6" stopColor={color} stopOpacity="0.18" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis grid (tick labels are rendered as HTML overlay above) */}
        {yTicks.map((v, i) => (
          <line
            key={i}
            x1={PAD_L}
            y1={y(v)}
            x2={W - PAD_R}
            y2={y(v)}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2 4"
          />
        ))}

        {/* Tournament-window band — stronger fill + saturated border. */}
        {startX !== null && endX !== null && (
          <rect
            x={startX}
            y={PAD_T}
            width={Math.max(2, endX - startX)}
            height={H - PAD_T - PAD_B}
            fill="rgba(114,184,255,0.18)"
            stroke="rgba(114,184,255,0.7)"
            strokeWidth="1.5"
          />
        )}

        {/* Area fill — only in area view. Solid baseline + gradient on top so
            the area state is unambiguously distinct from line. */}
        {view === "area" && (
          <>
            <path
              d={fillPath}
              fill={color}
              fillOpacity="0.10"
            />
            <path d={fillPath} fill={`url(#${gradId})`} />
          </>
        )}

        {/* Stroke */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={view === "line" ? "2.6" : "2"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover guideline + dot */}
        {activeIdx != null && (
          <g pointerEvents="none">
            <line
              x1={x(activeIdx)}
              y1={PAD_T}
              x2={x(activeIdx)}
              y2={H - PAD_B}
              stroke="rgba(251,253,254,0.4)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(activeIdx)}
              cy={y(data[activeIdx].value)}
              r="6"
              fill="rgba(10,10,12,0.95)"
              stroke={color}
              strokeWidth="2.5"
            />
          </g>
        )}
      </svg>

      {/* HTML tooltip overlay — positioned in % so it scales with the SVG. */}
      {activePoint &&
        tooltipLeftPct !== null &&
        tooltipTopPct !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-border-hi bg-bg-2 px-3 py-2 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.7)]"
            style={{
              left: `clamp(64px, ${tooltipLeftPct}%, calc(100% - 64px))`,
              top: `calc(${tooltipTopPct}% - 56px)`,
            }}
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2">
              {formatHoverDate(activePoint.date)}
            </div>
            <div
              className="mt-1 font-display text-[18px] font-bold leading-none tabular-nums"
              style={{ color }}
            >
              {activePoint.value.toFixed(1)}
            </div>
          </div>
        )}
    </div>
  );
}
