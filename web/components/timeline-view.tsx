"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";

import { TimelineHeatmap } from "@/components/timeline-heatmap";
import { GapMode, Team } from "@/lib/data";

// The 3D terrain pulls in three.js / r3f, so it is code-split and client-only
// (never SSR'd). It only mounts when the user switches to the 3D lens, so the
// 2D heatmap path carries no WebGL cost.
const TimelineTerrain = dynamic(
  () => import("@/components/timeline-terrain").then((m) => m.TimelineTerrain),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex w-full items-center justify-center rounded-[14px] border border-border bg-[#06070a] font-mono text-xs uppercase tracking-[0.14em] text-ink-3"
        style={{ height: "min(72vh, 640px)" }}
      >
        Loading terrain…
      </div>
    ),
  },
);

type Lens = "2d" | "3d";

type Props = {
  teams: Team[];
  mode: GapMode;
  windowDates: string[];
  maxDailyHype: number;
  selectionSundayDate?: string;
  filterBar?: ReactNode;
  selectedTeam: string | null;
  onSelect: (team: Team) => void;
};

export function TimelineView(props: Props) {
  const [lens, setLens] = useState<Lens>("2d");

  const toggle = (
    <div
      role="group"
      aria-label="Timeline view"
      className="inline-flex shrink-0 self-center rounded-lg border border-border bg-[rgba(0,0,0,0.25)] p-0.5"
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
            {l === "2d" ? "Heatmap" : "Terrain 3D"}
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
        <header className="mb-12 flex flex-col items-center gap-8 text-center md:mb-16 md:gap-9">
          <div>
            <div className="mb-4 flex items-center justify-center gap-2 font-mono text-sm uppercase tracking-[0.14em] text-ink-2">
              <span className="text-core-bright">03</span>
              <span aria-hidden className="leading-none text-ink-3">·</span>
              <span className="text-ink-1">The Timeline</span>
            </div>
            <h2
              className="m-0 mx-auto max-w-[760px] font-display font-bold leading-[1.4em] tracking-[-0.01em] text-ink"
              style={{ fontSize: "clamp(24px, 3vw, 38px)" }}
            >
              The hype window as <span className="text-core-bright">terrain</span>.
              Loud ridges <span className="text-core-bright">crackle</span>.
            </h2>
          </div>
          {toggle}
        </header>
        {props.filterBar}
        <TimelineTerrain teams={props.teams} mode={props.mode} />
      </section>
    );
  }

  return <TimelineHeatmap {...props} lensToggle={toggle} />;
}
