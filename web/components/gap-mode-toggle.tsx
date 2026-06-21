"use client";

import { GapMode } from "@/lib/data";

type Props = {
  mode: GapMode;
  onChange: (m: GapMode) => void;
};

const COPY: Record<GapMode, string> = {
  tournament: "15-day hype window vs. tournament wins",
  season: "Full-season hype vs. season win %",
};

export function GapModeToggle({ mode, onChange }: Props) {
  return (
    <div className="mx-auto max-w-7xl px-5 pt-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-[10px] border border-border bg-background p-0.5">
          <Pill active={mode === "tournament"} onClick={() => onChange("tournament")}>
            Tournament gap
          </Pill>
          <Pill active={mode === "season"} onClick={() => onChange("season")}>
            Season gap
          </Pill>
        </div>
        <span className="font-mono text-xs uppercase tracking-normal text-muted-foreground">
          {COPY[mode]}
        </span>
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[7px] px-3 py-1 font-mono text-xs uppercase tracking-normal transition-colors ${
        active
          ? "bg-brand text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
