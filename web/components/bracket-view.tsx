"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { BracketTree } from "@/components/bracket-tree";
import { Region, Team } from "@/lib/data";

const Bracket3D = dynamic(
  () => import("@/components/bracket-3d").then((m) => m.Bracket3D),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex w-full items-center justify-center rounded-[14px] border border-border bg-[#06070a] font-mono text-xs uppercase tracking-[0.14em] text-ink-3"
        style={{ height: "min(74vh, 680px)" }}
      >
        Loading bracket…
      </div>
    ),
  },
);

type Lens = "2d" | "3d";

type Props = {
  teams: Team[];
  filteredTeams: Team[];
  selectedRegion: Region | "all";
  selectedTeam: string | null;
  onSelect: (team: Team) => void;
};

export function BracketView(props: Props) {
  const [lens, setLens] = useState<Lens>("2d");

  const toggle = (
    <div
      role="group"
      aria-label="Bracket view"
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
            {l === "2d" ? "Bracket" : "Tree 3D"}
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
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 font-mono text-sm uppercase tracking-[0.14em] text-ink-2">
              <span className="text-core-bright">04</span> /{" "}
              <span className="text-ink-1">The Bracket</span>
            </div>
            <h2
              className="m-0 max-w-[720px] font-display font-bold leading-[1.4em] tracking-[-0.005em] text-ink"
              style={{ fontSize: "clamp(22px, 2.6vw, 34px)" }}
            >
              Four regions <span className="text-core-bright">converging</span>.
              Current climbs the <span className="text-core-bright">winning paths</span>.
            </h2>
          </div>
          {toggle}
        </header>
        <Bracket3D teams={props.teams} onSelect={props.onSelect} />
      </section>
    );
  }

  return <BracketTree {...props} lensToggle={toggle} />;
}
