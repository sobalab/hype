"use client";

// Dev-only Tweaks panel. Gated by NODE_ENV at the import site (see app-shell).
// Persists values to localStorage and writes them to CSS custom properties on
// :root so all components pick them up live.

import { useEffect, useState } from "react";

import { Icon } from "@/components/icon";

type BgTone = "pure" | "deep" | "charcoal";
type GridStyle = "dots" | "lines" | "off";
type Density = "compact" | "regular";

type Tweaks = {
  density: Density;
  gridStyle: GridStyle;
  gridIntensity: number;
  auroraIntensity: number;
  accentColor: string;
  bgTone: BgTone;
};

const DEFAULTS: Tweaks = {
  density: "compact",
  gridStyle: "dots",
  gridIntensity: 0.8,
  auroraIntensity: 0.15,
  accentColor: "#1277de",
  bgTone: "charcoal",
};

const STORAGE_KEY = "hyp3-tweaks";

const BG_TONES: Record<BgTone, { bg: string; bg1: string; bg2: string }> = {
  pure: { bg: "#0a0a0c", bg1: "#0e0e10", bg2: "#131418" },
  deep: { bg: "#08090d", bg1: "#0c0d12", bg2: "#11131a" },
  charcoal: { bg: "#16161a", bg1: "#1c1c22", bg2: "#22232b" },
};

function readStored(): Tweaks {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Tweaks>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function TweaksPanel() {
  const [t, setT] = useState<Tweaks>(DEFAULTS);
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setT(readStored());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.style.setProperty("--grid-opacity", String(t.gridIntensity));
    root.style.setProperty("--aurora-intensity", String(t.auroraIntensity));
    root.style.setProperty("--core", t.accentColor);
    const bg = BG_TONES[t.bgTone];
    root.style.setProperty("--bg", bg.bg);
    root.style.setProperty("--bg-1", bg.bg1);
    root.style.setProperty("--bg-2", bg.bg2);

    // Toggle the body backdrop grid via classes on the layout shell.
    const grid = document.querySelector("[data-bg-grid]");
    if (grid) {
      grid.classList.remove("bg-dotgrid", "bg-linegrid");
      if (t.gridStyle === "dots") grid.classList.add("bg-dotgrid");
      else if (t.gridStyle === "lines") grid.classList.add("bg-linegrid");
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    } catch {
      // localStorage may be unavailable; tweaks just won't persist.
    }
  }, [t, mounted]);

  if (!mounted) return null;

  const update = <K extends keyof Tweaks>(key: K, value: Tweaks[K]) =>
    setT((prev) => ({ ...prev, [key]: value }));

  return (
    <div
      className="fixed bottom-4 right-4 z-[2000] w-[280px] rounded-2xl border border-border-hi bg-bg-2/95 text-ink shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-1">
          Tweaks <Icon name="bullet" size={5} className="mx-1 inline-block align-middle" /> dev
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded p-1 text-ink-2 transition-colors hover:bg-white/10 hover:text-ink"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? "−" : "+"}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-3 px-3.5 py-3">
          <Section label="Layout" />
          <Radio
            label="Density"
            value={t.density}
            options={["compact", "regular"]}
            onChange={(v) => update("density", v as Density)}
          />
          <Section label="Backdrop" />
          <Radio
            label="Grid"
            value={t.gridStyle}
            options={["dots", "lines", "off"]}
            onChange={(v) => update("gridStyle", v as GridStyle)}
          />
          <Slider
            label="Grid intensity"
            value={t.gridIntensity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => update("gridIntensity", v)}
          />
          <Slider
            label="Aurora glow"
            value={t.auroraIntensity}
            min={0}
            max={1.2}
            step={0.05}
            onChange={(v) => update("auroraIntensity", v)}
          />
          <Radio
            label="Background"
            value={t.bgTone}
            options={["pure", "deep", "charcoal"]}
            onChange={(v) => update("bgTone", v as BgTone)}
          />
          <Section label="Accent" />
          <Swatches
            value={t.accentColor}
            options={["#1277de", "#72b8ff", "#f995b6", "#66e7d8", "#b4b4ef"]}
            onChange={(v) => update("accentColor", v)}
          />
        </div>
      )}
    </div>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div className="pt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3 first:pt-0">
      {label}
    </div>
  );
}

function Radio({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-1">
        {label}
      </div>
      <div className="inline-flex rounded-md border border-border bg-white/[0.03] p-0.5">
        {options.map((o) => {
          const active = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={`flex-1 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
                active
                  ? "bg-white/[0.08] text-ink"
                  : "text-ink-1 hover:text-ink"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-ink-1">
        <span>{label}</span>
        <span className="text-ink-3 tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full accent-core-bright"
      />
    </div>
  );
}

function Swatches({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((c) => {
        const active = value.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-pressed={active}
            className="h-9 flex-1 rounded-md border transition-all"
            style={{
              background: c,
              borderColor: active ? "var(--ink)" : "rgba(255,255,255,0.16)",
              boxShadow: active ? "inset 0 0 0 2px rgba(0,0,0,0.6)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
