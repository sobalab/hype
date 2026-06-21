"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Icon } from "@/components/icon";
import {
  GapMode,
  Region,
  REGIONS,
  ROUND_LABEL,
  ROUND_ORDER,
  Round,
  StoryTag,
  TAG_LABEL,
  TAG_ORDER,
} from "@/lib/data";

// Per-tag accent — raw hex so SVG, inline style, and box-shadow can all share.
const TAG_COLOR: Record<StoryTag, string> = {
  overhyped: "#f995b6",
  underhyped: "#66e7d8",
  as_expected: "#efecaf",
  noise: "#b4b4ef",
};

type Props = {
  mode: GapMode;
  setMode: (m: GapMode) => void;
  selectedTags: Set<StoryTag>;
  selectedRegion: Region | "all";
  selectedRound: Round;
  tagCounts: Record<StoryTag, number>;
  showRoundFilter?: boolean;
  /** Divergent replaces the binary scope toggle with its own slider, so the
      toggle is hidden there. Defaults to shown for the other views. */
  showScope?: boolean;
  onToggleTag: (tag: StoryTag) => void;
  onSetRegion: (r: Region | "all") => void;
  onSetRound: (r: Round) => void;
  onReset: () => void;
};

export function FilterBar({
  mode,
  setMode,
  selectedTags,
  selectedRegion,
  selectedRound,
  tagCounts,
  showRoundFilter = true,
  showScope = true,
  onToggleTag,
  onSetRegion,
  onSetRound,
  onReset,
}: Props) {
  // Always-visible inline strip from sm up; below sm it collapses behind this
  // toggle to preserve scroll space. The CSS `sm:!` overrides force it open and
  // hide the toggle on larger screens regardless of `open`.
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 md:mb-8">
      {/* Mobile-only toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="hyp3-inline-filters"
        className={`inline-flex min-h-10 w-full items-center justify-between gap-3 border bg-[var(--surface)] px-3.5 font-display text-[12px] font-black uppercase tracking-[0.12em] text-ink-1 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-bright/60 sm:hidden ${
          open
            ? "rounded-t-[12px] border-border border-b-0"
            : "mb-2 rounded-[10px] border-border-hi"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          {!open && (
            <span aria-hidden className="relative inline-flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-core-bright opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-core-bright shadow-[0_0_8px_var(--core-bright)]" />
            </span>
          )}
          Filters
        </span>
        {open ? (
          <ChevronUp aria-hidden className="size-4 text-ink-2" />
        ) : (
          <ChevronDown aria-hidden className="size-4 text-ink-2" />
        )}
      </button>

      {/* Controls — collapsible on mobile, always shown from sm up. */}
      <div
        id="hyp3-inline-filters"
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out sm:!grid-rows-[1fr] sm:!opacity-100 ${
          open
            ? "grid-rows-[1fr] opacity-100"
            : "pointer-events-none grid-rows-[0fr] opacity-0 sm:pointer-events-auto"
        }`}
      >
        <div className="min-h-0 overflow-hidden sm:overflow-visible">
          <div
            className={`flex flex-col gap-7 border border-border bg-[rgba(255,255,255,0.025)] p-5 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-9 sm:gap-y-6 sm:p-6 sm:!rounded-[12px] ${
              open ? "rounded-b-[12px]" : "rounded-[12px]"
            }`}
          >
            {showScope && (
              <FieldGroup label="Scope">
                <ModeToggle mode={mode} setMode={setMode} />
              </FieldGroup>
            )}

            <FieldGroup
              label="Story"
              sublabel={
                selectedTags.size === TAG_ORDER.length
                  ? "All"
                  : `${selectedTags.size}/${TAG_ORDER.length}`
              }
            >
              <div className="flex flex-wrap gap-2.5">
                {TAG_ORDER.map((tag) => {
                  const active = selectedTags.has(tag);
                  const color = TAG_COLOR[tag];
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onToggleTag(tag)}
                      aria-pressed={active}
                      // 44px tap target on mobile (a11y); compact on md+.
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-1.5 font-display text-[12px] font-black uppercase tracking-[0.08em] transition-all md:min-h-9 md:px-3 md:py-1"
                      style={{
                        borderColor: active ? color : "var(--border)",
                        background: active ? `${color}22` : "transparent",
                        color: active ? color : "var(--ink-1)",
                        opacity: active ? 1 : 0.55,
                      }}
                    >
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full"
                        style={{ background: color }}
                      />
                      {TAG_LABEL[tag]}
                      <span
                        className="ml-0.5 rounded-full border bg-black/30 px-1.5 py-px font-mono text-[12px] tabular-nums"
                        style={{ borderColor: "currentColor" }}
                      >
                        {tagCounts[tag] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </FieldGroup>

            <FieldGroup label="Region">
              <Segmented
                options={[{ id: "all", label: "All" }, ...REGIONS.map((r) => ({ id: r, label: r }))]}
                value={selectedRegion}
                onChange={(v) => onSetRegion(v as Region | "all")}
              />
            </FieldGroup>

            {showRoundFilter && (
              <FieldGroup label="Round">
                <RoundDropdown value={selectedRound} setValue={onSetRound} />
              </FieldGroup>
            )}

            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg border border-border bg-transparent px-2.5 py-1.5 font-display text-[12px] font-black uppercase tracking-[0.12em] text-ink-1 transition-colors hover:border-border-hi hover:text-ink sm:ml-auto sm:mt-[22px] sm:min-h-9 sm:px-3 sm:py-1"
            >
              <Icon name="reset" size={12} />
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-2">
        {label}
        {sublabel && <span className="ml-1.5 text-ink-3">{sublabel}</span>}
      </span>
      {children}
    </div>
  );
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: GapMode;
  setMode: (m: GapMode) => void;
}) {
  const modes: { id: GapMode; label: string; sub: string }[] = [
    { id: "tournament", label: "Tournament", sub: "15-day" },
    { id: "season", label: "Season", sub: "5-mo" },
  ];
  return (
    <div className="grid w-full grid-cols-2 gap-0.5 rounded-xl border-[1.5px] border-border bg-[rgba(0,0,0,0.25)] p-1 sm:inline-flex sm:w-fit">
      {modes.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            aria-pressed={active}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-2.5 py-1.5 transition-all sm:w-auto sm:px-3 md:min-h-9 md:px-3.5 md:py-1 ${
              active
                ? "bg-[rgba(255,255,255,0.08)] text-ink shadow-[inset_0_0_0_1px_var(--border-hi)]"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-ink"
              style={{ opacity: active ? 1 : 0.3 }}
            />
            <span className="font-display text-[12px] font-black uppercase leading-none tracking-[0.08em]">
              {m.label}
            </span>
            <span
              className={`ml-1 hidden border-l border-border pl-1.5 font-mono text-[12px] tracking-[0.1em] sm:inline ${
                active ? "text-white" : "text-ink-3"
              }`}
            >
              {m.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  // Mobile (<sm): grid with first option full-width on its own row, the
  // remaining options share an evenly split row below. sm+: original
  // inline-flex with wrap behavior.
  const restCount = Math.max(options.length - 1, 1);
  return (
    <div
      role="group"
      className="grid w-full gap-[3px] rounded-[10px] border-[1.5px] border-border bg-[rgba(0,0,0,0.25)] p-[3px] sm:inline-flex sm:w-fit sm:max-w-full sm:flex-wrap sm:gap-0"
      style={{ gridTemplateColumns: `repeat(${restCount}, minmax(0, 1fr))` }}
    >
      {options.map((o, i) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={`inline-flex min-h-11 w-full items-center justify-center rounded-[7px] px-2.5 py-1.5 font-display text-[12px] font-black uppercase tracking-[0.06em] transition-all sm:w-auto md:min-h-9 md:px-3 md:py-1 ${
              i === 0 ? "col-span-full sm:col-span-1" : ""
            } ${
              active
                ? "bg-[rgba(255,255,255,0.06)] text-ink shadow-[inset_0_0_0_1px_var(--border-hi)]"
                : "text-ink-1 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function RoundDropdown({
  value,
  setValue,
}: {
  value: Round;
  setValue: (r: Round) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-11 w-full min-w-[160px] items-center justify-between gap-2 rounded-lg border-[1.5px] border-border bg-[rgba(0,0,0,0.25)] px-2.5 py-1.5 font-display text-[12px] font-black uppercase tracking-[0.06em] text-ink-1 transition-colors hover:border-border-strong sm:w-auto md:min-h-9 md:px-3 md:py-1"
      >
        <span>{ROUND_LABEL[value]}</span>
        <ChevronDown
          aria-hidden
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+4px)] z-20 min-w-[200px] overflow-hidden rounded-[10px] border border-border-hi bg-bg-2 p-1 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.7)]"
        >
          {ROUND_ORDER.map((r) => {
            const active = r === value;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setValue(r);
                  setOpen(false);
                }}
                role="menuitemcheckbox"
                aria-checked={active}
                className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-display text-[12px] font-black uppercase tracking-[0.06em] transition-colors ${
                  active
                    ? "bg-[rgba(255,255,255,0.04)] text-ink"
                    : "text-ink-1 hover:bg-[rgba(255,255,255,0.03)] hover:text-ink"
                }`}
              >
                <span className="inline-flex w-5 shrink-0 justify-center font-mono text-base leading-none text-ink">
                  {active ? "✓" : ""}
                </span>
                {ROUND_LABEL[r]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
