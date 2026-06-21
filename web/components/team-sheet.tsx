"use client";

import { useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { Icon } from "@/components/icon";
import { Provenance, ProvInfo } from "@/components/provenance";
import { useIsMobile } from "@/lib/use-is-mobile";
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
  if (!Number.isFinite(v) || v < 0) return "—";
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

// Centered modal (radix Dialog — same primitive the side Sheet used, no new
// dep). Centered card at every breakpoint; scrolls within a 90dvh cap.
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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto overscroll-contain rounded-2xl border border-border-hi bg-bg-1 shadow-[0_30px_90px_-24px_rgba(0,0,0,0.9)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
        >
          {team ? (
            <TeamModalBody
              team={team}
              mode={mode}
              hypeWindowStart={hypeWindowStart}
              hypeWindowEnd={hypeWindowEnd}
              meta={meta}
            />
          ) : (
            <div className="p-6">
              <DialogPrimitive.Title className="font-display text-lg text-ink">
                Loading…
              </DialogPrimitive.Title>
            </div>
          )}

          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute right-4 top-4 z-10 inline-flex size-9 items-center justify-center rounded-lg border border-border bg-bg-2/80 text-ink-2 backdrop-blur transition-colors hover:border-border-hi hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-bright/60"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function TeamModalBody({
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
  // Headline copy reads from `active` so the panel reflects the current mode.
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
      className="relative isolate flex flex-col gap-7 sm:gap-8"
      style={{ padding: "clamp(1.75rem, 4.5vw, 2.5rem)" }}
    >
      {/* Aurora glow behind the header */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] opacity-40 blur-[60px]"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${color}33, transparent 65%)`,
        }}
      />

      {/* Header — team-name-led, centered. Context folded into one meta line. */}
      <header className="flex flex-col items-center gap-4 text-center">
        <DialogPrimitive.Title
          className="m-0 break-words font-display font-bold leading-tight tracking-[-0.01em] text-ink"
          style={{ fontSize: "clamp(28px, 6vw, 40px)" }}
        >
          {team.team}
        </DialogPrimitive.Title>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-[12px] uppercase tracking-[0.12em] text-ink-2">
          <span className="tabular-nums text-core-bright">
            #{String(team.seed).padStart(2, "0")} SEED
          </span>
          <Dot />
          <span>{team.region} Region</span>
          <Dot />
          <span className="tabular-nums">
            {team.season_wins}–{team.season_losses}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 tracking-[0.1em]"
            style={{ color, borderColor: `${color}55`, background: `${color}11` }}
          >
            <Icon name="bullet" size={9} />
            {TAG_LABEL[active.storyTag]}
          </span>
        </div>
      </header>

      {/* Gap callout — centered number/label; story sentence left-aligned. */}
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.025)] px-6 py-7 text-center">
        <Provenance
          info={prov.gapActive}
          className="mb-2 inline-flex justify-center font-mono text-[12px] uppercase tracking-[0.16em] text-ink-2"
        >
          {modeLabel} Gap
        </Provenance>
        <div
          className="font-display font-bold leading-none tracking-[-0.02em] tabular-nums"
          style={{
            color,
            textShadow: "0 0 24px currentColor",
            fontSize: "clamp(44px, 8vw, 56px)",
          }}
        >
          {gap > 0 ? `+${gap}` : gap}
        </div>
        <p className="mx-auto mt-3 max-w-[460px] text-left font-sans text-base leading-[1.55] text-ink-1">
          {gapStoryCopy(mode, team, active, gap)}
        </p>
      </div>

      {/* Stat grid — 2 cols on mobile, 4 across from sm. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        <Stat label="Wins" value={String(team.wins)} prov={prov.wins} />
        <Stat label={`${modeLabel} hype`} value={`#${active.hypeRank}`} prov={prov.hypeRank} />
        <Stat label={`${modeLabel} perf`} value={`#${active.perfRank}`} prov={prov.perfRank} />
        <Stat label="Hype index" value={active.hypeIndex.toFixed(1)} prov={prov.hypeIndex} />
        <Stat
          label="Hype accel"
          value={formatAcceleration(team.hype_acceleration)}
          prov={prov.hypeAccel}
        />
        <Stat
          label="Perf accel"
          value={formatAcceleration(team.performance_acceleration)}
          prov={prov.perfAccel}
        />
        <Stat
          label={`${otherModeLabel} gap`}
          value={other.gap > 0 ? `+${other.gap}` : `${other.gap}`}
          prov={prov.gapOther}
        />
        <Stat label="Peak" value={peak.value.toFixed(0)} sub={shortDate(peak.date)} />
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
  );
}

function Dot() {
  return <span aria-hidden className="text-ink-3">·</span>;
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="font-mono text-[13px] uppercase tracking-[0.16em] text-ink-1">
          {showTournamentWindow ? "Full season hype curve" : "Season hype curve"}
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
      <div className="font-mono text-[12px] tracking-[0.1em] text-ink-2">
        peaked {peak.value.toFixed(0)} on {shortDate(peak.date)}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  prov,
}: {
  label: string;
  value: string;
  sub?: string;
  prov?: ProvInfo;
}) {
  const labelCls =
    "break-words font-mono text-[11px] uppercase tracking-[0.1em] text-ink-2";
  return (
    <div className="bg-bg-1 px-5 py-4">
      {prov ? (
        <Provenance info={prov} className={labelCls}>
          <span>{label}</span>
        </Provenance>
      ) : (
        <div className={labelCls}>{label}</div>
      )}
      <div className="mt-1.5 font-display text-[20px] font-bold leading-none text-ink">
        {value}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[11px] tracking-[0.08em] text-ink-3">
          {sub}
        </div>
      )}
    </div>
  );
}

function formatHoverDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const monthShort = MONTHS[m - 1];
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

  // Reserve space for the "Tournament window" badge only when shown.
  const topPad = showTournamentWindow ? 28 : 0;

  const W = 600;
  // Fixed height (the modal scrolls), so no fluid measuring is needed.
  const H = isMobile ? 260 : 320;
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
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => p * max);

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

  const tooltipLeftPct = activeIdx != null ? (x(activeIdx) / W) * 100 : null;
  const tooltipTopPct =
    activeIdx != null ? (y(data[activeIdx].value) / H) * 100 : null;
  const windowLabelLeftPct = startX !== null ? (startX / W) * 100 : null;

  return (
    <div ref={wrapRef} className="relative" style={{ paddingTop: topPad }}>
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

      {windowLabelLeftPct !== null && (
        <div
          className="pointer-events-none absolute top-0 z-[2] inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-core-bright/55 bg-bg-2/95 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-core-bright"
          style={
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

        {view === "area" && (
          <>
            <path d={fillPath} fill={color} fillOpacity="0.10" />
            <path d={fillPath} fill={`url(#${gradId})`} />
          </>
        )}

        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={view === "line" ? "2.6" : "2"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

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

      {activePoint && tooltipLeftPct !== null && tooltipTopPct !== null && (
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
