"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Braces, Copy, Download, ExternalLink, Search, X } from "lucide-react";

import { Icon } from "@/components/icon";
import { Team, dataset } from "@/lib/data";

const MAX_RESULTS = 8;

// "Fork the data" — the open single JSON is the product, so make grabbing it a
// first-class action in the palette rather than something you read about.
type ForkCommand = {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  icon: ReactNode;
  /** Copy actions keep the palette open and flash "Copied"; others close it. */
  copy?: boolean;
};

const FORK_COMMANDS: ForkCommand[] = [
  { id: "download", label: "Download the dataset", hint: "json", keywords: "fork download save export file", icon: <Download aria-hidden className="size-4" /> },
  { id: "open", label: "Open the raw JSON", hint: "new tab", keywords: "open raw view api endpoint", icon: <ExternalLink aria-hidden className="size-4" /> },
  { id: "copy-url", label: "Copy the data URL", hint: "clipboard", keywords: "copy url link address", icon: <Copy aria-hidden className="size-4" />, copy: true },
  { id: "copy-fetch", label: "Copy a fetch() snippet", hint: "clipboard", keywords: "copy fetch snippet code javascript", icon: <Braces aria-hidden className="size-4" />, copy: true },
];

export function FloatingSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);

  const teams: Team[] = dataset.teams;
  const year = dataset.metadata.tournament_year;

  const commands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FORK_COMMANDS;
    return FORK_COMMANDS.filter((c) =>
      `${c.label} ${c.keywords}`.toLowerCase().includes(q),
    );
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const runCommand = (cmd: ForkCommand) => {
    const path = `/data/${year}.json`;
    const url = `${window.location.origin}${path}`;
    if (cmd.id === "download") {
      const a = document.createElement("a");
      a.href = path;
      a.download = `hyp3-${year}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      close();
    } else if (cmd.id === "open") {
      window.open(path, "_blank", "noopener,noreferrer");
      close();
    } else if (cmd.id === "copy-url") {
      navigator.clipboard?.writeText(url);
      flashCopied(cmd.id);
    } else if (cmd.id === "copy-fetch") {
      navigator.clipboard?.writeText(`fetch(${JSON.stringify(url)}).then((r) => r.json())`);
      flashCopied(cmd.id);
    }
  };

  const flashCopied = (id: string) => {
    setCopied(id);
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...teams]
        .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
        .slice(0, MAX_RESULTS);
    }
    return teams
      .filter((t) => t.team.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [query, teams]);

  useEffect(() => {
    if (open) {
      // Defer to next paint so the input is mounted.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll while modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const select = (team: Team) => {
    setOpen(false);
    setQuery("");
    // Navigate to divergent with the team pre-selected via URL.
    router.push(`/divergent?team=${encodeURIComponent(team.team)}`);
  };

  return (
    <>
      {/* Full-viewport wrapper, pointer-events: none so it doesn't block the
          page. The button inside is absolutely positioned relative to this
          fixed wrapper. This indirection sidesteps iOS Safari quirks where
          `position: fixed` directly on the button can drift with scroll. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 40,
        }}
      >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search teams (⌘K)"
        className="flex h-12 items-center gap-2 rounded-full border border-core-bright/40 bg-bg-2/95 px-4 font-mono text-sm uppercase tracking-[0.12em] text-ink shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6),0_0_0_3px_rgba(114,184,255,0.08)] backdrop-blur transition-all hover:bg-bg-2 hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.7),0_0_0_4px_rgba(114,184,255,0.14)] sm:h-12 sm:px-5"
        style={{
          position: "absolute",
          bottom: "max(env(safe-area-inset-bottom, 0px) + 0.75rem, 1.25rem)",
          right: "1.25rem",
          pointerEvents: "auto",
        }}
      >
        <Search aria-hidden className="size-4 text-core-bright" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-border bg-[rgba(255,255,255,0.05)] px-1.5 py-px font-mono text-[11px] text-ink-2 sm:inline">
          ⌘K
        </kbd>
      </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search teams"
          className="fixed inset-0 z-[55] flex items-start justify-center bg-black/60 px-4 pt-[10vh] backdrop-blur-sm"
          onClick={() => {
            setOpen(false);
            setQuery("");
          }}
        >
          <div
            className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-border-hi bg-bg-2 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search aria-hidden className="size-4 shrink-0 text-ink-2" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (matches.length > 0) select(matches[0]);
                  else if (commands.length > 0) runCommand(commands[0]);
                }}
                placeholder="Search teams or fork the data…"
                aria-label="Search teams"
                className="w-full bg-transparent font-sans text-base text-ink placeholder:text-ink-3 focus:outline-none"
              />
              <kbd className="hidden rounded border border-border bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 font-mono text-[11px] text-ink-2 sm:inline">
                ESC
              </kbd>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                }}
                className="rounded p-1 text-ink-2 transition-colors hover:text-ink sm:hidden"
                aria-label="Close search"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-1.5">
              {commands.length === 0 && matches.length === 0 ? (
                <div className="px-3 py-6 text-center font-mono text-[12px] uppercase tracking-[0.1em] text-ink-2">
                  No matches for &ldquo;{query}&rdquo;
                </div>
              ) : (
                <>
                {commands.length > 0 && (
                  <ul className="mb-1">
                    <li className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                      Fork the data
                    </li>
                    {commands.map((cmd) => (
                      <li key={cmd.id}>
                        <button
                          type="button"
                          onClick={() => runCommand(cmd)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)] focus-visible:bg-[rgba(255,255,255,0.04)] focus-visible:outline-none"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="shrink-0 text-core-bright">{cmd.icon}</span>
                            <span className="truncate font-sans text-[15px] text-ink">
                              {cmd.label}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] ${copied === cmd.id ? "text-underhyped" : "text-ink-2"}`}
                          >
                            {copied === cmd.id ? "Copied" : cmd.hint}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {matches.length > 0 && (
                <ul>
                  {!query && (
                    <li className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                      Biggest gaps
                    </li>
                  )}
                  {matches.map((t) => (
                    <li key={t.team}>
                      <button
                        type="button"
                        onClick={() => select(t)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)] focus-visible:bg-[rgba(255,255,255,0.04)] focus-visible:outline-none"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="font-mono text-sm font-semibold tabular-nums text-core-bright">
                            {String(t.seed).padStart(2, "0")}
                          </span>
                          <span className="truncate font-sans text-[15px] text-ink">
                            {t.team}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2">
                            {t.region}
                          </span>
                          <span
                            className="rounded-full border border-border bg-black/40 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums"
                            style={{
                              color:
                                t.gap > 0
                                  ? "var(--underhyped)"
                                  : t.gap < 0
                                  ? "var(--overhyped)"
                                  : "var(--ink-2)",
                            }}
                          >
                            {t.gap > 0 ? `+${t.gap}` : t.gap}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                )}
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border bg-black/30 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-2">
              <span>
                <Icon name="return" size={10} className="mr-1 inline-block align-middle" /> to open
              </span>
              <Link
                href="/divergent"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 text-core-bright transition-colors hover:text-ink"
              >
                View all 68
                <Icon name="right-arrow" size={10} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
