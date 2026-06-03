"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/icon";
import { useReveal } from "@/components/motion/use-reveal";
import { StoryTag, Team } from "@/lib/data";

const TAG_COLOR: Record<StoryTag, string> = {
  overhyped: "#f995b6",
  underhyped: "#66e7d8",
  as_expected: "#efecaf",
  noise: "#b4b4ef",
};

const ROUND_LABELS = [
  "First Round",
  "Second",
  "Sweet 16",
  "Elite 8",
  "Final Four",
  "Runner-up",
  "Champion",
] as const;

const SHORT_ROUND_LABELS = [
  "R64",
  "R32",
  "S16",
  "E8",
  "F4",
  "F2",
  "CH",
] as const;

type Props = {
  teams: Team[];
  selectedTeam: string | null;
  onSelect: (team: Team) => void;
};

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

export function ScatterChartView({ teams, selectedTeam, onSelect }: Props) {
  const isMobile = useIsMobile();
  // Dots pop in on mount / route navigation; closes before filter/scope edits.
  const revealing = useReveal(1400);
  const calls = useMemo(() => {
    const above = [...teams].filter((t) => t.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3);
    const below = [...teams].filter((t) => t.gap < 0).sort((a, b) => a.gap - b.gap).slice(0, 3);
    return { above, below };
  }, [teams]);

  if (teams.length === 0) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-24 text-center text-base text-ink-2 sm:px-7">
        No teams match the current filters.
      </div>
    );
  }

  const W = isMobile ? 480 : 1200;
  const H = isMobile ? 520 : 760;
  // Mobile labels are short (CH/F2/F4/E8/S16/R32/R64) — ~24px wide max.
  // Desktop labels are full names ("First Round" etc.) — ~92px wide.
  // PAD_L = label width + tick offset (8/14) + breathing room from container edge.
  const PAD_L = isMobile ? 72 : 170;
  const PAD_R = isMobile ? 40 : 110;
  const PAD_T = isMobile ? 48 : 80;
  const PAD_B = isMobile ? 100 : 130;
  const PW = W - PAD_L - PAD_R;
  const PH = H - PAD_T - PAD_B;
  const labelSize = isMobile ? 12 : 14;
  const tickSize = isMobile ? 11 : 13;
  const zoneSize = isMobile ? 11 : 14;

  const xFor = (hype: number) =>
    PAD_L + (Math.min(100, hype) / 100) * PW;
  const yFor = (wins: number) => PAD_T + PH - (wins / 6) * PH;

  return (
    <section
      className="relative mx-auto max-w-[1180px]"
      style={{
        padding:
          "clamp(2.5rem, 6vw, 4.5rem) clamp(1.25rem, 4vw, 2rem) clamp(3rem, 7vw, 5rem)",
      }}
    >
      <header className="mb-8 flex flex-col gap-10 md:mb-10 md:gap-12">
        <div>
          <div className="mb-3 font-mono text-sm uppercase tracking-[0.14em] text-ink-2">
            <span className="text-core-bright">02</span> /{" "}
            <span className="text-ink-1">The Scatter</span>
          </div>
          <h2
            className="m-0 max-w-[820px] font-display font-bold leading-[1.4em] tracking-[-0.005em] text-ink"
            style={{ fontSize: "clamp(22px, 2.6vw, 34px)" }}
          >
            The diagonal is the{" "}
            <span className="text-core-bright">bet</span>. Distance from it is
            the <span className="text-core-bright">miss</span>.
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2.5">
            <span
              className="font-display font-bold leading-none text-ink"
              style={{ fontSize: "clamp(26px, 4.5vw, 36px)" }}
            >
              {teams.length}
            </span>
            <span className="font-mono text-sm uppercase tracking-[0.16em] text-ink-2">
              Teams
            </span>
          </div>
          <p className="m-0 max-w-md text-base leading-[1.6] text-[#D7EBFF]">
            X = hype. Y = wins. Distance from the diagonal is the gap.
          </p>
        </div>
      </header>

      {/* Chart + callouts. Default (xs): callouts stack column below chart.
          sm-md: callouts in a row below chart.
          lg+: callouts move to the right of the chart, vertically stacked. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
        <div
          className="relative order-1 flex-1 overflow-hidden rounded-[14px] border border-border bg-bg-1"
          style={{ aspectRatio: isMobile ? "12 / 13" : "12 / 7.5" }}
        >

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="relative z-[1] block size-full"
        >
          <defs>
            <linearGradient id="scatter-diag" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#f995b6" stopOpacity="0.5" />
              <stop offset="0.5" stopColor="#72b8ff" stopOpacity="0.8" />
              <stop offset="1" stopColor="#66e7d8" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          <rect
            x={PAD_L}
            y={PAD_T}
            width={PW}
            height={PH}
            fill="rgba(255,255,255,0.01)"
          />

          {/* Grid */}
          {[0, 1, 2, 3, 4, 5, 6].map((w) => (
            <line
              key={`y-${w}`}
              x1={PAD_L}
              y1={yFor(w)}
              x2={W - PAD_R}
              y2={yFor(w)}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="2 4"
            />
          ))}
          {[0, 25, 50, 75, 100].map((h) => (
            <line
              key={`x-${h}`}
              x1={xFor(h)}
              y1={PAD_T}
              x2={xFor(h)}
              y2={H - PAD_B}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="2 4"
            />
          ))}

          {/* Expected diagonal */}
          <line
            x1={xFor(0)}
            y1={yFor(0)}
            x2={xFor(100)}
            y2={yFor(6)}
            stroke="url(#scatter-diag)"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />

          {/* Zone labels */}
          <foreignObject
            x={xFor(isMobile ? 5 : 12)}
            y={yFor(5.5) - zoneSize}
            width={isMobile ? 220 : 320}
            height={zoneSize * 1.8}
          >
            <div
              style={{
                color: "rgba(102,231,216,0.75)",
                fontFamily: "var(--font-mono)",
                fontSize: zoneSize,
                letterSpacing: "0.14em",
                whiteSpace: "nowrap",
                lineHeight: 1,
              }}
            >
              <Icon name="up-arrow" size={zoneSize * 0.9} className="mr-2 inline-block align-middle" />
              UNDERHYPED
            </div>
          </foreignObject>
          <foreignObject
            x={xFor(isMobile ? 50 : 58)}
            y={yFor(0.5) - zoneSize}
            width={isMobile ? 220 : 320}
            height={zoneSize * 1.8}
          >
            <div
              style={{
                color: "rgba(249,149,182,0.75)",
                fontFamily: "var(--font-mono)",
                fontSize: zoneSize,
                letterSpacing: "0.14em",
                whiteSpace: "nowrap",
                lineHeight: 1,
              }}
            >
              <Icon name="down-arrow" size={zoneSize * 0.9} className="mr-2 inline-block align-middle" />
              OVERHYPED
            </div>
          </foreignObject>

          {/* Dots */}
          {teams.map((t, i) => {
            const x = xFor(t.hype_normalized);
            const y = yFor(t.wins);
            const color = TAG_COLOR[t.story_tag];
            const isSel = selectedTeam === t.team;
            const baseR = isMobile ? 6 : 7;
            const bigR = isMobile ? 8 : 10;
            const r = isSel ? bigR + 2 : Math.abs(t.gap) > 25 ? bigR : baseR;
            return (
              <g
                key={t.team}
                className={revealing ? "viz-pop" : undefined}
                style={{
                  cursor: "pointer",
                  ...(revealing
                    ? {
                        transformBox: "fill-box",
                        transformOrigin: "center",
                        animationDelay: `${Math.min(i * 11, 650)}ms`,
                      }
                    : null),
                }}
                onClick={() => onSelect(t)}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={r + 10}
                  fill={color}
                  opacity="0.25"
                  style={{ filter: "blur(5px)" }}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={color}
                  fillOpacity={isSel ? 1 : 0.95}
                  stroke="rgba(10,10,12,0.9)"
                  strokeWidth="1.6"
                />
                {isSel && (
                  <circle
                    cx={x}
                    cy={y}
                    r={r + 5}
                    fill="none"
                    stroke="#72b8ff"
                    strokeWidth="1.8"
                  />
                )}
              </g>
            );
          })}

          {/* X axis ticks */}
          {[0, 25, 50, 75, 100].map((h) => (
            <text
              key={`xt-${h}`}
              x={xFor(h)}
              y={H - PAD_B + (isMobile ? 28 : 32)}
              fill="rgba(251,253,254,0.7)"
              fontFamily="var(--font-mono)"
              fontSize={tickSize}
              textAnchor="middle"
            >
              {h}
            </text>
          ))}
          <text
            x={PAD_L + PW / 2}
            y={H - (isMobile ? 36 : 48)}
            fill="rgba(251,253,254,0.85)"
            fontFamily="var(--font-mono)"
            fontSize={labelSize}
            letterSpacing="0.16em"
            textAnchor="middle"
            fontWeight="600"
          >
            HYPE INDEX (0–100)
          </text>

          {/* Y axis ticks */}
          {[0, 1, 2, 3, 4, 5, 6].map((w) => (
            <text
              key={`yt-${w}`}
              x={PAD_L - (isMobile ? 8 : 14)}
              y={yFor(w) + 4}
              fill="rgba(251,253,254,0.8)"
              fontFamily="var(--font-mono)"
              fontSize={tickSize}
              textAnchor="end"
            >
              {isMobile ? SHORT_ROUND_LABELS[w] : ROUND_LABELS[w]}
            </text>
          ))}
        </svg>
        </div>

        <div className="order-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-[280px] lg:shrink-0 lg:flex-col lg:flex-nowrap lg:gap-4">
          <CalloutGroup label="Most underhyped" tag="underhyped" teams={calls.above} arrow="up-arrow" />
          <CalloutGroup label="Most overhyped" tag="overhyped" teams={calls.below} arrow="down-arrow" />
        </div>
      </div>
    </section>
  );
}

function CalloutGroup({
  label,
  tag,
  teams,
  arrow,
}: {
  label: string;
  tag: StoryTag;
  teams: Team[];
  arrow: "up-arrow" | "down-arrow";
}) {
  const color = TAG_COLOR[tag];
  return (
    <div className="min-w-[200px] flex-1 rounded-[10px] border border-border bg-[rgba(255,255,255,0.025)] px-4 py-3 lg:flex-none">
      <div
        className="mb-2 font-mono text-sm uppercase tracking-[0.14em]"
        style={{ color }}
      >
        <Icon name={arrow} size={11} className="mr-1.5 inline-block align-middle" /> {label}
      </div>
      <div className="flex flex-col gap-1">
        {teams.map((t) => (
          <div
            key={t.team}
            className="grid grid-cols-[44px_1fr_auto] items-center gap-2"
          >
            <span
              className="font-mono text-sm font-bold tabular-nums"
              style={{ color }}
            >
              {t.gap > 0 ? `+${t.gap}` : t.gap}
            </span>
            <span className="truncate font-sans text-sm text-ink">{t.team}</span>
            <span className="font-mono text-sm tabular-nums text-core-bright">
              {String(t.seed).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
