"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/icon";
import { useReveal } from "@/components/motion/use-reveal";
import { StoryTag, Team } from "@/lib/data";
import { useIsMobile } from "@/lib/use-is-mobile";

const TAG_COLOR: Record<StoryTag, string> = {
  overhyped: "#f995b6",
  underhyped: "#66e7d8",
  as_expected: "#efecaf",
  noise: "#b4b4ef",
};

// Residual recolor endpoints. A dot above the user's line (out-performed the
// bet) trends teal; below (fell short) trends pink; near the line stays the
// neutral blue core.
const NEUTRAL: RGB = [114, 184, 255];
const OVER: RGB = [102, 231, 216];
const UNDER: RGB = [249, 149, 182];

type RGB = [number, number, number];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

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

// The user's expectation line: expected wins at hype 0 (y0) and at hype 100
// (y1). The default {0, 6} is the original diagonal.
export type BetLine = { y0: number; y1: number };
export const DEFAULT_LINE: BetLine = { y0: 0, y1: 6 };
const KEY_STEP = 0.25;
const r2 = (n: number) => Math.round(n * 100) / 100;
const isDefaultLine = (l: BetLine) =>
  l.y0 === DEFAULT_LINE.y0 && l.y1 === DEFAULT_LINE.y1;

type Props = {
  teams: Team[];
  /** Resolved line (app-shell owns it for URL portability). */
  value: BetLine;
  /** Commit a finished gesture; null means "reset to default diagonal". */
  onCommit: (line: BetLine | null) => void;
  selectedTeam: string | null;
  onSelect: (team: Team) => void;
  /** Optional control (the 2D/3D lens toggle) rendered in the header. */
  lensToggle?: ReactNode;
  /** Inline filter strip, rendered under the header (above the chart). */
  filterBar?: ReactNode;
};

export function ScatterChartView({ teams, value, onCommit, selectedTeam, onSelect, lensToggle, filterBar }: Props) {
  const isMobile = useIsMobile();
  // Dots pop in on mount / route navigation; closes before filter/scope edits.
  const revealing = useReveal(1400);

  // Local draft so dragging is smooth; the resolved line is committed to
  // app-shell (and the URL) only on gesture end, not on every pointer move.
  const [line, setLine] = useState<BetLine>(value);
  const [focusedHandle, setFocusedHandle] = useState<"left" | "right" | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    mode: "left" | "right" | "body";
    startY0: number;
    startY1: number;
    startWins: number;
  } | null>(null);

  // Adopt an externally-restored value (shared link / URL) unless mid-drag.
  useEffect(() => {
    if (dragRef.current) return;
    setLine((cur) => (cur.y0 === value.y0 && cur.y1 === value.y1 ? cur : value));
  }, [value.y0, value.y1]);

  const commit = (l: BetLine) => {
    const rounded = { y0: r2(l.y0), y1: r2(l.y1) };
    onCommit(isDefaultLine(rounded) ? null : rounded);
  };

  const isCustom = line.y0 !== DEFAULT_LINE.y0 || line.y1 !== DEFAULT_LINE.y1;

  const calls = useMemo(() => {
    const above = [...teams].filter((t) => t.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3);
    const below = [...teams].filter((t) => t.gap < 0).sort((a, b) => a.gap - b.gap).slice(0, 3);
    return { above, below };
  }, [teams]);

  // Expected wins under the user's line at a given hype.
  const expectedAt = (hype: number) =>
    line.y0 + (line.y1 - line.y0) * (Math.min(100, Math.max(0, hype)) / 100);

  // Average absolute miss of the field against the user's line, in wins.
  const miss = useMemo(() => {
    if (teams.length === 0) return 0;
    let s = 0;
    for (const t of teams) s += Math.abs(t.wins - expectedAt(t.hype_normalized));
    return s / teams.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, line.y0, line.y1]);

  if (teams.length === 0) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-24 text-center text-base text-ink-2 sm:px-7">
        No teams match the current filters.
      </div>
    );
  }

  const W = isMobile ? 480 : 1200;
  // Square viewBox so the square container (aspect-ratio 1/1) is filled exactly
  // — no letterboxing, no distortion. All padding/plot math derives from W/H.
  const H = W;
  const PAD_L = isMobile ? 72 : 170;
  const PAD_R = isMobile ? 40 : 110;
  const PAD_T = isMobile ? 48 : 80;
  const PAD_B = isMobile ? 100 : 130;
  const PW = W - PAD_L - PAD_R;
  const PH = H - PAD_T - PAD_B;
  const labelSize = isMobile ? 12 : 14;
  const tickSize = isMobile ? 11 : 13;
  const zoneSize = isMobile ? 11 : 14;

  const xFor = (hype: number) => PAD_L + (Math.min(100, hype) / 100) * PW;
  const yFor = (wins: number) => PAD_T + PH - (wins / 6) * PH;

  // Convert a screen Y (clientY) into wins using the SVG's live CTM, so it is
  // correct regardless of viewBox scaling / letterboxing.
  const clientToWins = (clientY: number): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = 0;
    pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return ((PAD_T + PH - local.y) / PH) * 6;
  };

  const beginDrag = (
    mode: "left" | "right" | "body",
    e: React.PointerEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      mode,
      startY0: line.y0,
      startY1: line.y1,
      startWins: clientToWins(e.clientY) ?? 0,
    };
  };

  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const w = clientToWins(e.clientY);
    if (w == null) return;
    if (d.mode === "left") {
      setLine((L) => ({ ...L, y0: clamp(w, 0, 6) }));
    } else if (d.mode === "right") {
      setLine((L) => ({ ...L, y1: clamp(w, 0, 6) }));
    } else {
      // Body drag: translate both ends together, preserving slope.
      const raw = w - d.startWins;
      const lo = Math.min(d.startY0, d.startY1);
      const hi = Math.max(d.startY0, d.startY1);
      const delta = clamp(raw, -lo, 6 - hi);
      setLine({ y0: d.startY0 + delta, y1: d.startY1 + delta });
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    const wasDragging = dragRef.current !== null;
    dragRef.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      // pointer may already be released
    }
    if (wasDragging) commit(line);
  };

  const onHandleKey = (which: "left" | "right", e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") delta = KEY_STEP;
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") delta = -KEY_STEP;
    else return;
    e.preventDefault();
    const next =
      which === "left"
        ? { ...line, y0: clamp(line.y0 + delta, 0, 6) }
        : { ...line, y1: clamp(line.y1 + delta, 0, 6) };
    setLine(next);
    commit(next);
  };

  const lx = xFor(0);
  const rx = xFor(100);
  const ly = yFor(line.y0);
  const ry = yFor(line.y1);

  return (
    <section
      className="relative mx-auto max-w-[1180px]"
      style={{
        padding:
          "clamp(2.5rem, 6vw, 4.5rem) clamp(1.25rem, 4vw, 2rem) clamp(3rem, 7vw, 5rem)",
      }}
    >
      {/* Centered web3 intro — matches the Divergent template. */}
      <header className="mb-12 flex flex-col items-center gap-8 text-center md:mb-16 md:gap-9">
        <div>
          <div className="mb-4 flex items-center justify-center gap-2 font-mono text-sm uppercase tracking-[0.14em] text-ink-2">
            <span className="text-core-bright">02</span>
            <span aria-hidden className="leading-none text-ink-3">·</span>
            <span className="text-ink-1">The Scatter</span>
          </div>
          <h2
            className="m-0 mx-auto max-w-[760px] font-display font-bold leading-[1.4em] tracking-[-0.005em] text-ink"
            style={{ fontSize: "clamp(24px, 3vw, 38px)" }}
          >
            Draw your own <span className="text-core-bright">bet</span>. Distance
            from your line is the <span className="text-core-bright">miss</span>.
          </h2>
        </div>
        <div className="flex flex-col items-center gap-4">
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
          <p className="m-0 max-w-md text-left text-[17px] leading-[1.6] text-[#D7EBFF]">
            Drag the line, or either end, to set how much hype should buy. Every
            dot recolors by its distance from your line.
          </p>
        </div>
        {lensToggle}
      </header>

      {filterBar}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_300px] lg:items-start lg:gap-6">
        {/* Leaderboards — above the chart on mobile (2-up from sm so they read
            as squarer tiles); right column, lower, on desktop. */}
        <div className="order-1 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:order-none lg:col-start-2 lg:row-start-2 lg:grid-cols-1">
          <CalloutGroup label="Most underhyped" tag="underhyped" teams={calls.above} arrow="up-arrow" />
          <CalloutGroup label="Most overhyped" tag="overhyped" teams={calls.below} arrow="down-arrow" />
        </div>

        <div
          className="relative order-2 overflow-hidden rounded-[14px] border border-border bg-bg-1 lg:order-none lg:col-start-1 lg:row-start-1 lg:row-span-2"
          style={{ aspectRatio: "1 / 1" }}
        >

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="relative z-[1] block size-full"
          style={{ touchAction: "none" }}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
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

          {/* Ghost of the original diagonal — the bet you started from. Only
              shown once the line has been moved, as a reference. */}
          {isCustom && (
            <line
              x1={xFor(0)}
              y1={yFor(0)}
              x2={xFor(100)}
              y2={yFor(6)}
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1.2"
              strokeDasharray="2 7"
            />
          )}

          {/* The user's bet line. */}
          <line
            x1={lx}
            y1={ly}
            x2={rx}
            y2={ry}
            stroke="url(#scatter-diag)"
            strokeWidth="2"
            strokeDasharray={isCustom ? undefined : "4 6"}
          />
          {/* Fat transparent hit-line for dragging the body. */}
          <line
            x1={lx}
            y1={ly}
            x2={rx}
            y2={ry}
            stroke="transparent"
            strokeWidth="22"
            style={{ cursor: "grab" }}
            onPointerDown={(e) => beginDrag("body", e)}
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
              BEAT THE BET
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
              MISSED THE BET
            </div>
          </foreignObject>

          {/* Dots — recolored live by residual from the user's line. */}
          {teams.map((t, i) => {
            const x = xFor(t.hype_normalized);
            const y = yFor(t.wins);
            const res = t.wins - expectedAt(t.hype_normalized);
            const mag = Math.min(1, Math.abs(res) / 4);
            const [cr, cg, cb] = lerpRGB(NEUTRAL, res >= 0 ? OVER : UNDER, mag);
            const color = `rgb(${cr}, ${cg}, ${cb})`;
            const isSel = selectedTeam === t.team;
            const baseR = isMobile ? 6 : 7;
            const bigR = isMobile ? 8 : 10;
            const r = isSel ? bigR + 2 : Math.abs(res) > 2.5 ? bigR : baseR;
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
                  style={{ filter: "blur(5px)", transition: "fill 140ms linear" }}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={color}
                  fillOpacity={isSel ? 1 : 0.95}
                  stroke="rgba(10,10,12,0.9)"
                  strokeWidth="1.6"
                  style={{ transition: "fill 140ms linear" }}
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

          {/* Bet-line endpoint handles. Focusable sliders: arrow keys nudge by
              0.25 wins. Larger invisible hit-target for touch. */}
          {([
            { which: "left" as const, hx: lx, hy: ly, val: line.y0, label: "Expected wins at low hype" },
            { which: "right" as const, hx: rx, hy: ry, val: line.y1, label: "Expected wins at high hype" },
          ]).map((h) => (
            <g key={h.which}>
              {focusedHandle === h.which && (
                <circle cx={h.hx} cy={h.hy} r={16} fill="none" stroke="#72b8ff" strokeWidth="1.5" opacity="0.7" />
              )}
              <circle cx={h.hx} cy={h.hy} r={7} fill="#0a0a0c" stroke="#72b8ff" strokeWidth="2.5" />
              <circle cx={h.hx} cy={h.hy} r={3} fill="#72b8ff" />
              <circle
                cx={h.hx}
                cy={h.hy}
                r={22}
                fill="transparent"
                tabIndex={0}
                role="slider"
                aria-label={h.label}
                aria-orientation="vertical"
                aria-valuemin={0}
                aria-valuemax={6}
                aria-valuenow={Math.round(h.val * 100) / 100}
                style={{ cursor: "ns-resize", outline: "none" }}
                onPointerDown={(e) => beginDrag(h.which, e)}
                onFocus={() => setFocusedHandle(h.which)}
                onBlur={() => setFocusedHandle(null)}
                onKeyDown={(e) => onHandleKey(h.which, e)}
              />
            </g>
          ))}

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

        {/* Bet card — below the chart on mobile; top of the right column on
            desktop. */}
        <div className="order-3 lg:order-none lg:col-start-2 lg:row-start-1">
          <BetCard
            miss={miss}
            isCustom={isCustom}
            onReset={() => {
              setLine(DEFAULT_LINE);
              onCommit(null);
            }}
          />
        </div>
      </div>
    </section>
  );
}

function BetCard({
  miss,
  isCustom,
  onReset,
}: {
  miss: number;
  isCustom: boolean;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    try {
      navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard may be unavailable; the URL is still shareable from the bar
    }
  };
  return (
    <div className="h-full rounded-[12px] border border-core-bright/40 bg-[rgba(18,119,222,0.10)] px-5 py-4">
      <div className="mb-2 font-mono text-sm uppercase tracking-[0.14em] text-core-bright">
        Your bet line
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold tabular-nums text-ink">
          {miss.toFixed(2)}
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink-2">
          avg miss (wins)
        </span>
      </div>
      <p className="mt-2 mb-0 font-mono text-[11px] leading-[1.5] tracking-[0.04em] text-ink-2">
        Lower is a tighter fit. Drag the ends or use arrow keys when a handle is
        focused.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyLink}
          disabled={!isCustom}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-core-bright/50 bg-[rgba(18,119,222,0.16)] px-2.5 py-1 font-display text-[12px] font-black uppercase tracking-[0.1em] text-core-bright transition-colors enabled:hover:bg-[rgba(18,119,222,0.26)] disabled:opacity-40"
        >
          <Icon name="bullet" size={6} className="inline-block" />
          {copied ? "Link copied" : "Copy bet link"}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={!isCustom}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 font-display text-[12px] font-black uppercase tracking-[0.1em] text-ink-1 transition-colors enabled:hover:border-border-hi enabled:hover:text-ink disabled:opacity-40"
        >
          <Icon name="reset" size={12} />
          Reset
        </button>
      </div>
    </div>
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
    <div className="h-full rounded-[12px] border border-border bg-[rgba(255,255,255,0.025)] px-5 py-4">
      <div
        className="mb-3 font-mono text-sm uppercase tracking-[0.14em]"
        style={{ color }}
      >
        <Icon name={arrow} size={11} className="mr-1.5 inline-block align-middle" /> {label}
      </div>
      <ol className="flex flex-col">
        {teams.map((t, i) => (
          <li
            key={t.team}
            className="grid grid-cols-[16px_42px_1fr_auto] items-center gap-2.5 border-b border-border/40 py-2 last:border-0 last:pb-0"
          >
            <span className="font-mono text-[12px] tabular-nums text-ink-3">
              {i + 1}
            </span>
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
          </li>
        ))}
      </ol>
    </div>
  );
}
