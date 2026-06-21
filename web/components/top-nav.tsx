"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Dataset, GapMode } from "@/lib/data";

// Module-scope flag flipped by a nav click; the freshly-mounted TopNav on
// the destination route consumes it. Each route renders its own AppShell, so
// component state would reset — a module variable survives.
let pendingScrollOnNav = false;

function scrollToContent() {
  document
    .getElementById("hyp3-content")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type Channel = { href: string; no: string; nm: string };

const CHANNELS: Channel[] = [
  { href: "/divergent", no: "I", nm: "Divergent" },
  { href: "/scatter", no: "II", nm: "Scatter" },
  { href: "/timeline", no: "III", nm: "Timeline" },
  { href: "/bracket", no: "IV", nm: "Bracket" },
];

type Props = {
  dataset: Dataset;
  // Interactive props are present on the data views (AppShell). The marketing
  // landing ("/") mounts the nav for navigation only, so they're optional:
  // without setMode the Scope toggle is omitted; year/signal fall back to the
  // bundled dataset.
  mode?: GapMode;
  setMode?: (m: GapMode) => void;
  years?: number[];
  currentYear?: number;
  onYear?: (year: number) => void;
};

// Deterministic oscilloscope trace (pure sines, no RNG, so SSR === CSR). The
// amplitude is driven by the active channel's signal.
function wavePath(amp: number, seed: number, w = 800, h = 44): string {
  const n = 64;
  const mid = h / 2;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    const t = i * 0.5 + seed;
    const y =
      mid +
      Math.sin(t) * 6 * amp +
      Math.sin(t * 2.3 + seed) * 4 * amp +
      Math.sin(t * 5.1 + seed * 2) * 2.2 * amp;
    pts.push(`${x.toFixed(1)},${Math.max(3, Math.min(h - 3, y)).toFixed(1)}`);
  }
  return pts.join(" ");
}

export function TopNav({ dataset, mode, setMode, years, currentYear, onYear }: Props) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);

  // Resolved values so the nav works with or without the interactive props.
  const effMode: GapMode = mode ?? "tournament";
  const effYears = years ?? [dataset.metadata.tournament_year];
  const effYear = currentYear ?? dataset.metadata.tournament_year;

  // -1 on the landing route ("/") and any non-channel path: no channel is
  // active, so the sliding highlight + LED stay in their resting state. Only an
  // actual channel route lights up. (Do NOT collapse this to Math.max(0, …) —
  // that forced Divergent to read as active on the front door.)
  const activeIndex = CHANNELS.findIndex((c) => c.href === pathname);

  // Publish nav height as a CSS var so the filter toolbar can stack below it.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const write = () =>
      document.documentElement.style.setProperty(
        "--hyp3-nav-h",
        `${el.offsetHeight}px`,
      );
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleTabClick = (href: string) => {
    if (href === pathname) scrollToContent();
    else pendingScrollOnNav = true;
  };
  useEffect(() => {
    if (!pendingScrollOnNav) return;
    pendingScrollOnNav = false;
    setTimeout(scrollToContent, 0);
  }, [pathname]);

  // Sliding channel selector — measure the active tab and spring the highlight
  // to it (and on resize / route change).
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [sel, setSel] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const b = btnRefs.current[activeIndex];
    if (b) setSel({ x: b.offsetLeft, w: b.offsetWidth });
  }, [activeIndex]);
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const remeasure = () => {
      const b = btnRefs.current[activeIndex];
      if (b) setSel({ x: b.offsetLeft, w: b.offsetWidth });
    };
    const ro = new ResizeObserver(remeasure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [activeIndex]);

  // Per-channel signal readout from real dataset values (mode-aware).
  const signal = useMemo(() => {
    const teams = dataset.teams;
    const gapOf = (t: (typeof teams)[number]) =>
      effMode === "season" ? t.season_gap : t.gap;
    const tagOf = (t: (typeof teams)[number]) =>
      effMode === "season" ? t.season_story_tag : t.story_tag;
    switch (activeIndex) {
      case 1: {
        const n = teams.filter((t) => tagOf(t) !== "as_expected").length;
        return { label: "OFF DIAGONAL", value: `${n} TEAMS`, amp: 0.6 };
      }
      case 2: {
        let mx = 0;
        for (const t of teams) if (t.hype_acceleration > mx) mx = t.hype_acceleration;
        return { label: "PEAK SURGE", value: `${mx.toFixed(1)}× ACCEL`, amp: 1.2 };
      }
      case 3: {
        const n = teams.filter((t) => t.seed >= 11 && t.wins >= 1).length;
        return { label: "UPSETS", value: `${n} TEAMS`, amp: 0.7 };
      }
      default: {
        let mn = Infinity;
        let mx = -Infinity;
        for (const t of teams) {
          const g = gapOf(t);
          if (g < mn) mn = g;
          if (g > mx) mx = g;
        }
        return { label: "GAP RANGE", value: `${mn} / +${mx}`, amp: 0.95 };
      }
    }
  }, [dataset, effMode, activeIndex]);

  const yearIdx = effYears.indexOf(effYear);
  const isSeason = effMode === "season";

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 bg-bg/95 backdrop-blur-md"
      style={{ paddingInline: "clamp(0.75rem, 3vw, 1.5rem)", paddingBlock: "0.6rem" }}
    >
      <nav
        aria-label="HYP3 console"
        className="cn-console mx-auto flex max-w-[1440px] flex-wrap items-stretch gap-3 rounded-[18px] border border-border-hi px-3 py-2.5 sm:gap-4 sm:px-4 lg:gap-5"
      >
        <span aria-hidden className="cn-screw" style={{ top: 9, left: 9 }} />
        <span aria-hidden className="cn-screw" style={{ top: 9, right: 9 }} />
        <span aria-hidden className="cn-screw" style={{ bottom: 9, left: 9 }} />
        <span aria-hidden className="cn-screw" style={{ bottom: 9, right: 9 }} />

        {/* Logo + year, nudged right (no power LED, no group label) */}
        <div className="flex flex-col justify-center gap-1.5 pl-2 sm:pl-3">
          <Link
            href="/"
            aria-label="HYP3 home"
            className="flex shrink-0 items-center gap-2.5"
          >
            <Image
              src="/media/hype-logo.svg"
              alt=""
              width={39}
              height={41}
              priority
              className="h-7 w-auto"
            />
            <span className="font-display text-[22px] font-black uppercase leading-none tracking-[0.03em] text-ink">
              HYP<span className="text-core-bright">3</span>
            </span>
          </Link>
          {/* Year, formatted under the logo */}
          <div className="cn-track inline-flex w-fit items-center gap-2 rounded-[10px] px-2.5 py-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">
              Year
            </span>
            {effYears.length > 1 ? (
              <>
                <Step label="Previous year" disabled={yearIdx <= 0} onClick={() => onYear?.(effYears[yearIdx - 1])}>
                  −
                </Step>
                <span className="min-w-[42px] text-center font-mono text-[14px] tabular-nums text-ink">
                  {effYear}
                </span>
                <Step label="Next year" disabled={yearIdx >= effYears.length - 1} onClick={() => onYear?.(effYears[yearIdx + 1])}>
                  +
                </Step>
              </>
            ) : (
              <span className="font-mono text-[14px] tabular-nums text-ink">{effYear}</span>
            )}
          </div>
        </div>

        <span aria-hidden className="cn-divider hidden lg:block" />

        {setMode && (
          <>
            {/* Scope */}
            <Group label="Scope">
              <button
                type="button"
                role="switch"
                aria-checked={isSeason}
                aria-label="Scope: tournament or season"
                onClick={() => setMode(isSeason ? "tournament" : "season")}
                className="cn-track relative grid grid-cols-2 items-stretch rounded-[12px] p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-bright/60"
              >
                <span
                  aria-hidden
                  className="cn-knob absolute left-1 top-1 rounded-[8px]"
                  style={{
                    height: "calc(100% - 8px)",
                    width: "calc(50% - 4px)",
                    transform: isSeason ? "translateX(100%)" : "none",
                  }}
                />
                <span
                  className={`relative z-[1] whitespace-nowrap px-3.5 py-2 text-center font-mono text-[11px] uppercase tracking-[0.12em] transition-colors md:py-1.5 ${isSeason ? "text-ink-2" : "text-ink"}`}
                >
                  Tourn
                </span>
                <span
                  className={`relative z-[1] whitespace-nowrap px-3.5 py-2 text-center font-mono text-[11px] uppercase tracking-[0.12em] transition-colors md:py-1.5 ${isSeason ? "text-ink" : "text-ink-2"}`}
                >
                  Season
                </span>
              </button>
            </Group>
            <span aria-hidden className="cn-divider hidden lg:block" />
          </>
        )}

        {/* Channel — full-width own line below lg so the horizontal scroller is
            bounded by the container (no clipping); inline on desktop. */}
        <Group label="Channel" className="min-w-0 w-full lg:w-auto">
          <div className="-mx-1 max-w-full overflow-x-auto px-1 no-scrollbar">
            <div
              ref={trackRef}
              className="cn-track relative flex w-max gap-1.5 rounded-[13px] p-[5px]"
            >
              {sel && (
                <span
                  aria-hidden
                  className="cn-sel absolute left-0 top-[5px] rounded-[9px]"
                  style={{
                    height: "calc(100% - 10px)",
                    width: sel.w,
                    transform: `translateX(${sel.x}px)`,
                  }}
                />
              )}
              {CHANNELS.map((c, i) => {
                const active = i === activeIndex;
                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    scroll={false}
                    onClick={() => handleTabClick(c.href)}
                    aria-current={active ? "page" : undefined}
                    ref={(el) => {
                      btnRefs.current[i] = el;
                    }}
                    className="relative z-[1] flex min-h-11 min-w-[88px] flex-col items-start gap-1 rounded-[9px] px-3.5 py-2 transition-transform duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-bright/60 md:min-h-9"
                  >
                    <span
                      aria-hidden
                      className={`absolute right-2.5 top-2 size-1.5 rounded-full cn-led ${active ? "cn-led-on" : ""}`}
                    />
                    <span
                      className={`font-mono text-[11px] tracking-[0.1em] ${active ? "text-core-bright" : "text-ink-2"}`}
                    >
                      {c.no}
                    </span>
                    <span
                      className={`font-mono text-[12px] uppercase tracking-[0.14em] ${active ? "text-ink" : "text-ink-1"}`}
                    >
                      {c.nm}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </Group>

        <span aria-hidden className="cn-divider hidden xl:block" />

        {/* Signal */}
        <Group label="Signal" className="hidden min-w-[200px] flex-1 xl:flex">
          <div className="cn-scope relative h-[54px] overflow-hidden rounded-[10px]">
            <div aria-hidden className="cn-scope-grid absolute inset-0" />
            <svg
              viewBox="0 0 800 44"
              preserveAspectRatio="none"
              aria-hidden
              className="absolute inset-0 h-full w-[200%]"
            >
              <polyline
                className="cn-wave"
                fill="none"
                stroke="rgba(102,231,216,.28)"
                strokeWidth="1.5"
                points={wavePath(signal.amp * 0.7, 9)}
              />
              <polyline
                className="cn-wave"
                fill="none"
                stroke="var(--underhyped)"
                strokeWidth="1.6"
                points={wavePath(signal.amp, 1)}
              />
            </svg>
          </div>
          <div className="flex items-center justify-between px-0.5 font-mono text-[11px] tracking-[0.08em] text-ink-2">
            <span>{signal.label}</span>
            <b className="font-medium text-underhyped">{signal.value}</b>
          </div>
        </Group>
      </nav>
    </header>
  );
}

function Group({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col justify-center gap-1.5 ${className ?? ""}`}>
      <span className="pl-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3">
        {label}
      </span>
      {children}
    </div>
  );
}

function Step({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-lg border border-border bg-bg-2 text-[13px] leading-none text-ink-1 transition-colors enabled:hover:border-border-hi enabled:hover:bg-bg-3 enabled:hover:text-ink disabled:opacity-30 enabled:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-bright/60"
    >
      {children}
    </button>
  );
}
