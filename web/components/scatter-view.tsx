"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { BetLine, ScatterChartView } from "@/components/scatter-chart";
import { GapMode, Team } from "@/lib/data";

const Scatter3D = dynamic(
  () => import("@/components/scatter-3d").then((m) => m.Scatter3D),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex w-full items-center justify-center rounded-[14px] border border-border bg-[#06070a] font-mono text-xs uppercase tracking-[0.14em] text-ink-3"
        style={{ height: "min(72vh, 640px)" }}
      >
        Loading cloud…
      </div>
    ),
  },
);

type Lens = "2d" | "3d";

type Props = {
  teams: Team[];
  mode: GapMode;
  value: BetLine;
  onCommit: (line: BetLine | null) => void;
  selectedTeam: string | null;
  onSelect: (team: Team) => void;
};

export function ScatterView({ teams, mode, value, onCommit, selectedTeam, onSelect }: Props) {
  const [lens, setLens] = useState<Lens>("2d");

  const toggle = (
    <div
      role="group"
      aria-label="Scatter view"
      className="inline-flex shrink-0 rounded-lg border border-border bg-[rgba(0,0,0,0.25)] p-0.5"
    >
      {(["2d", "3d"] as const).map((l) => {
        const active = lens === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLens(l)}
            aria-pressed={active}
            className={`inline-flex min-h-9 items-center rounded-md px-3.5 py-1 font-display text-[12px] font-black uppercase tracking-[0.1em] transition-all ${
              active
                ? "bg-[rgba(255,255,255,0.08)] text-ink shadow-[inset_0_0_0_1px_var(--border-hi)]"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            {l === "2d" ? "Plot" : "Cloud 3D"}
          </button>
        );
      })}
    </div>
  );

  if (lens === "3d") {
    return (
      <section
        className="relative mx-auto max-w-[1180px]"
        style={{
          padding:
            "clamp(2.5rem, 6vw, 4.5rem) clamp(1.25rem, 4vw, 2rem) clamp(3rem, 7vw, 5rem)",
        }}
      >
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 font-mono text-sm uppercase tracking-[0.14em] text-ink-2">
              <span className="text-core-bright">02</span> /{" "}
              <span className="text-ink-1">The Scatter</span>
            </div>
            <h2
              className="m-0 max-w-[820px] font-display font-bold leading-[1.4em] tracking-[-0.005em] text-ink"
              style={{ fontSize: "clamp(22px, 2.6vw, 34px)" }}
            >
              The field as a <span className="text-core-bright">cloud</span>. Current
              arcs between <span className="text-core-bright">neighbors</span>.
            </h2>
          </div>
          {toggle}
        </header>
        <Scatter3D teams={teams} mode={mode} onSelect={onSelect} />
      </section>
    );
  }

  return (
    <ScatterChartView
      teams={teams}
      value={value}
      onCommit={onCommit}
      selectedTeam={selectedTeam}
      onSelect={onSelect}
      lensToggle={toggle}
    />
  );
}
