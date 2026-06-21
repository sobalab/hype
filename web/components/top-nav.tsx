"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

import { Dataset } from "@/lib/data";

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
  // Year-stepper props are present on the data views (AppShell). The landing
  // ("/") mounts the nav for navigation only, so they're optional and fall back
  // to the bundled dataset. The tournament/season scope toggle lives in the
  // filter bar (see filters.tsx), not the nav.
  years?: number[];
  currentYear?: number;
  onYear?: (year: number) => void;
};

export function TopNav({ dataset, years, currentYear, onYear }: Props) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);

  // Resolved values so the nav works with or without the interactive props.
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

  const yearIdx = effYears.indexOf(effYear);

  // Mobile menu (below lg the inline console collapses to a hamburger drawer).
  // Close it whenever the route changes.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40"
      style={{ paddingInline: "clamp(0.75rem, 3vw, 1.5rem)", paddingBlock: "0.6rem" }}
    >
      <nav
        aria-label="HYP3 console"
        className="cn-console mx-auto flex max-w-[1440px] flex-col rounded-[18px] border border-border-hi px-5 py-3 sm:px-6"
      >
        <span aria-hidden className="cn-screw" style={{ top: 9, left: 9 }} />
        <span aria-hidden className="cn-screw" style={{ top: 9, right: 9 }} />
        <span aria-hidden className="cn-screw" style={{ bottom: 9, left: 9 }} />
        <span aria-hidden className="cn-screw" style={{ bottom: 9, right: 9 }} />

        {/* TOP ROW — logo always; year/channels/status inline on lg+; hamburger
            on the right below lg. */}
        <div className="flex items-center gap-3 sm:gap-4 lg:gap-5">
          {/* Logo in a bordered cell + wordmark */}
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

          {/* Year pill — desktop only (mobile shows it inside the drawer).
              YearControl's base sets no display utility, so `hidden lg:inline-flex`
              here doesn't clash with a hardcoded flex. */}
          <YearControl
            className="hidden lg:inline-flex"
            effYears={effYears}
            effYear={effYear}
            yearIdx={yearIdx}
            onYear={onYear}
          />

          <span aria-hidden className="cn-divider hidden lg:block" />

          {/* Channel — horizontal tabs (roman, dot, name), centered. Desktop
              (lg+) only; below lg it lives in the hamburger drawer. */}
          <div className="hidden min-w-0 lg:flex lg:flex-1 lg:justify-center">
            <div
              ref={trackRef}
              className="cn-track relative flex w-max items-stretch gap-1 rounded-[12px] p-[5px]"
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
                    className="relative z-[1] flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-[9px] px-4 transition-transform duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-bright/60"
                  >
                    <span
                      className={`font-mono text-[12px] tracking-[0.12em] ${active ? "text-ink-2" : "text-ink-3"}`}
                    >
                      {c.no}
                    </span>
                    <span
                      aria-hidden
                      className={`size-1.5 shrink-0 rounded-full cn-led ${active ? "cn-led-on" : ""}`}
                    />
                    <span
                      className={`font-mono text-[12px] uppercase tracking-[0.14em] ${active ? "text-ink" : "text-ink-2"}`}
                    >
                      {c.nm}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <span aria-hidden className="cn-divider hidden xl:block" />

          {/* System status + latency — decorative readouts, xl+ only */}
          <div className="hidden items-center gap-6 pr-1 xl:flex">
            <Group label="System status">
              <span className="font-mono text-[13px] uppercase tracking-[0.12em] text-core-bright">
                Optimized
              </span>
            </Group>
            <Group label="Latency">
              <span className="font-mono text-[15px] tabular-nums tracking-[0.04em] text-ink">
                0.02ms
              </span>
            </Group>
          </div>

          {/* Hamburger — below lg, pushed to the right edge */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="hyp3-mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="cn-track ml-auto flex size-10 shrink-0 items-center justify-center rounded-[10px] text-ink transition-colors hover:text-core-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-bright/60 lg:hidden"
          >
            {menuOpen ? (
              <X aria-hidden className="size-5" />
            ) : (
              <Menu aria-hidden className="size-5" />
            )}
          </button>
        </div>

        {/* MOBILE DRAWER — below lg, expands from the hamburger. */}
        <div
          id="hyp3-mobile-menu"
          aria-hidden={!menuOpen}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out lg:hidden ${
            menuOpen
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mt-3 border-t border-border pt-3.5">
              {/* Year + decorative mode readout */}
              <div className="flex items-center justify-between gap-3">
                <YearControl
                  className="inline-flex"
                  effYears={effYears}
                  effYear={effYear}
                  yearIdx={yearIdx}
                  onYear={onYear}
                />
                <span className="text-right font-mono text-[12px] uppercase tracking-[0.14em] text-core-bright">
                  <span className="text-core">///</span> Mode: Navigation
                </span>
              </div>

              {/* Channel list — full-width vertical rows */}
              <div className="mt-3.5 flex flex-col gap-1.5">
                {CHANNELS.map((c, i) => {
                  const active = i === activeIndex;
                  return (
                    <Link
                      key={c.href}
                      href={c.href}
                      scroll={false}
                      onClick={() => {
                        handleTabClick(c.href);
                        setMenuOpen(false);
                      }}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-4 rounded-[12px] border px-4 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-bright/60 ${
                        active
                          ? "cn-sel"
                          : "border-transparent bg-[rgba(255,255,255,0.025)] hover:bg-[rgba(255,255,255,0.05)]"
                      }`}
                    >
                      <span
                        className={`w-5 shrink-0 font-mono text-[15px] tracking-[0.1em] ${active ? "text-core-bright" : "text-ink-3"}`}
                      >
                        {c.no}
                      </span>
                      <span
                        className={`flex-1 font-mono text-[16px] uppercase tracking-[0.12em] ${active ? "text-ink" : "text-ink-2"}`}
                      >
                        {c.nm}
                      </span>
                      <span
                        aria-hidden
                        className={`size-2 shrink-0 rounded-full cn-led ${active ? "cn-led-on" : ""}`}
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}

function YearControl({
  effYears,
  effYear,
  yearIdx,
  onYear,
  className,
}: {
  effYears: number[];
  effYear: number;
  yearIdx: number;
  onYear?: (year: number) => void;
  className?: string;
}) {
  return (
    <div
      className={`cn-track h-10 w-fit items-center gap-2.5 rounded-[10px] px-3 ${className ?? ""}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">
        Year
      </span>
      {effYears.length > 1 ? (
        <>
          <Step label="Previous year" disabled={yearIdx <= 0} onClick={() => onYear?.(effYears[yearIdx - 1])}>
            −
          </Step>
          <span className="min-w-[42px] text-center font-mono text-[15px] tabular-nums text-ink">
            {effYear}
          </span>
          <Step label="Next year" disabled={yearIdx >= effYears.length - 1} onClick={() => onYear?.(effYears[yearIdx + 1])}>
            +
          </Step>
        </>
      ) : (
        <span className="font-mono text-[15px] tabular-nums text-ink">{effYear}</span>
      )}
    </div>
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
