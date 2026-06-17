"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { BracketTree } from "@/components/bracket-tree";
import { Filters } from "@/components/filters";
import { Footer } from "@/components/footer";
import { GapChart } from "@/components/gap-chart";
import { BetLine, DEFAULT_LINE, ScatterChartView } from "@/components/scatter-chart";
import { TeamSheet } from "@/components/team-sheet";
import { TimelineView } from "@/components/timeline-view";
import { TopNav } from "@/components/top-nav";
import {
  Dataset,
  GapMode,
  REGIONS,
  Region,
  ROUND_ORDER,
  Round,
  StoryTag,
  TAG_ORDER,
  Team,
  applyRoundFilter,
  maxAbsGap,
  projectTeamForMode,
  tagCounts,
} from "@/lib/data";

// Years offered by the nav stepper. Only 2026 is complete (has season-mode
// fields + a finding); 2025 on disk is tournament-only and predates the season
// schema, so it's intentionally excluded until backfilled. With a single year
// the nav renders a static readout instead of a stepper.
const YEARS = [2026];

const VALID_TAGS = new Set<string>(TAG_ORDER);
const VALID_REGIONS = new Set<string>(REGIONS);
const VALID_ROUNDS = new Set<string>(ROUND_ORDER);
const VALID_MODES = new Set<GapMode>(["tournament", "season"]);

let hasClientHydrated = false;

function readStoredMode(): GapMode {
  try {
    const s = window.sessionStorage.getItem("hyp3-mode");
    return s === "season" ? "season" : "tournament";
  } catch {
    return "tournament";
  }
}

type Props = {
  data: Dataset;
  view: "gap" | "scatter" | "timeline" | "bracket";
};

const ALL_TAGS = new Set<StoryTag>(TAG_ORDER);

function YearSwapper({
  currentYear,
  onSwap,
}: {
  currentYear: number;
  onSwap: (d: Dataset) => void;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const raw = searchParams.get("year");
    if (!raw) return;
    const year = Number.parseInt(raw, 10);
    if (Number.isNaN(year)) return;
    if (year === currentYear) return;
    fetch(`/data/${year}.json`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))
      )
      .then((d: Dataset) => onSwap(d))
      .catch((e) =>
        console.warn(
          `[year=${year}] fetch failed; keeping bundled ${currentYear}:`,
          e
        )
      );
  }, [searchParams, currentYear, onSwap]);
  return null;
}

type UrlSyncState = {
  selectedTags: Set<StoryTag>;
  selectedRegion: Region | "all";
  selectedRound: Round;
  selectedTeam: Team | null;
  gapMode: GapMode;
  betLine: BetLine | null;
  teams: Team[];
  setSelectedTags: (s: Set<StoryTag>) => void;
  setSelectedRegion: (r: Region | "all") => void;
  setSelectedRound: (r: Round) => void;
  setSelectedTeam: (t: Team | null) => void;
  setGapMode: (m: GapMode) => void;
  setBetLine: (l: BetLine | null) => void;
};

function parseLineParam(raw: string | null): BetLine | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 2 || !parts.every((n) => Number.isFinite(n))) return null;
  const clampWins = (n: number) => Math.max(0, Math.min(6, n));
  const line = { y0: clampWins(parts[0]), y1: clampWins(parts[1]) };
  // A line equal to the default diagonal is "no bet" and carries no param.
  if (line.y0 === DEFAULT_LINE.y0 && line.y1 === DEFAULT_LINE.y1) return null;
  return line;
}

function UrlSync({
  selectedTags,
  selectedRegion,
  selectedRound,
  selectedTeam,
  gapMode,
  betLine,
  teams,
  setSelectedTags,
  setSelectedRegion,
  setSelectedRound,
  setSelectedTeam,
  setGapMode,
  setBetLine,
}: UrlSyncState) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const readJustSeeded = useRef(false);

  useEffect(() => {
    let didSeed = false;

    const tagsRaw = searchParams.get("tags");
    const parsedTags = tagsRaw
      ? (tagsRaw.split(",").filter((t) => VALID_TAGS.has(t)) as StoryTag[])
      : [];
    const expectedTags =
      parsedTags.length > 0 ? new Set(parsedTags) : ALL_TAGS;
    if (
      expectedTags.size !== selectedTags.size ||
      [...expectedTags].some((t) => !selectedTags.has(t))
    ) {
      setSelectedTags(expectedTags);
      didSeed = true;
    }

    const regionRaw = searchParams.get("region");
    const expectedRegion: Region | "all" =
      regionRaw && VALID_REGIONS.has(regionRaw) ? (regionRaw as Region) : "all";
    if (expectedRegion !== selectedRegion) {
      setSelectedRegion(expectedRegion);
      didSeed = true;
    }

    const roundRaw = searchParams.get("round");
    const expectedRound: Round =
      roundRaw && VALID_ROUNDS.has(roundRaw) ? (roundRaw as Round) : "all";
    if (expectedRound !== selectedRound) {
      setSelectedRound(expectedRound);
      didSeed = true;
    }

    const teamRaw = searchParams.get("team");
    const expectedTeam = teamRaw
      ? teams.find((x) => x.team === teamRaw) ?? null
      : null;
    if (expectedTeam?.team !== selectedTeam?.team) {
      setSelectedTeam(expectedTeam);
      didSeed = true;
    }

    const modeRaw = searchParams.get("mode");
    if (modeRaw && VALID_MODES.has(modeRaw as GapMode)) {
      const expectedMode = modeRaw as GapMode;
      if (expectedMode !== gapMode) {
        setGapMode(expectedMode);
        didSeed = true;
      }
    }

    const expectedLine = parseLineParam(searchParams.get("line"));
    const lineSame =
      (expectedLine === null && betLine === null) ||
      (!!expectedLine &&
        !!betLine &&
        expectedLine.y0 === betLine.y0 &&
        expectedLine.y1 === betLine.y1);
    if (!lineSame) {
      setBetLine(expectedLine);
      didSeed = true;
    }

    if (didSeed) readJustSeeded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, teams]);

  useEffect(() => {
    if (readJustSeeded.current) {
      readJustSeeded.current = false;
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    if (selectedTags.size === TAG_ORDER.length) {
      params.delete("tags");
    } else {
      const ordered = TAG_ORDER.filter((t) => selectedTags.has(t));
      params.set("tags", ordered.join(","));
    }

    if (selectedRegion === "all") params.delete("region");
    else params.set("region", selectedRegion);

    if (selectedRound === "all") params.delete("round");
    else params.set("round", selectedRound);

    if (!selectedTeam) params.delete("team");
    else params.set("team", selectedTeam.team);

    if (gapMode === "tournament") params.delete("mode");
    else params.set("mode", gapMode);

    if (!betLine) params.delete("line");
    else params.set("line", `${betLine.y0},${betLine.y1}`);

    const next = params.toString();
    const current = searchParams.toString();
    if (next === current) return;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [
    selectedTags,
    selectedRegion,
    selectedRound,
    selectedTeam,
    gapMode,
    betLine,
    pathname,
    router,
    searchParams,
  ]);

  return null;
}

export function AppShell({ data, view }: Props) {
  const [dataset, setDataset] = useState<Dataset>(data);
  const [selectedTags, setSelectedTags] = useState<Set<StoryTag>>(ALL_TAGS);
  const [selectedRegion, setSelectedRegion] = useState<Region | "all">("all");
  const [selectedRound, setSelectedRound] = useState<Round>("all");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [gapMode, setGapMode] = useState<GapMode>(() => {
    if (typeof window === "undefined") return "tournament";
    if (!hasClientHydrated) return "tournament";
    return readStoredMode();
  });
  const skipFirstModeWrite = useRef(true);

  // Continuous scope for the Divergent view (0 = tournament, 1 = season). It
  // stays in lockstep with the discrete `gapMode` that the other views,
  // filters, and the URL still use: scrubbing past the midpoint flips the
  // mode, and any external mode change snaps the scope to that end.
  const [scope, setScope] = useState<number>(gapMode === "season" ? 1 : 0);
  useEffect(() => {
    const end = gapMode === "season" ? 1 : 0;
    setScope((s) =>
      (s < 0.5 ? "tournament" : "season") === gapMode ? s : end,
    );
  }, [gapMode]);
  const onScope = (v: number) => {
    setScope(v);
    const m: GapMode = v < 0.5 ? "tournament" : "season";
    setGapMode((prev) => (prev === m ? prev : m));
  };

  // Scatter "draw your bet" line, lifted here so it survives in the URL as a
  // portable, account-free artifact. null = the default diagonal.
  const [betLine, setBetLine] = useState<BetLine | null>(null);

  // Nav year stepper writes ?year=; YearSwapper picks it up and swaps the
  // bundled dataset. usePathname/useRouter don't need a Suspense boundary
  // (only useSearchParams does).
  const yearRouter = useRouter();
  const yearPathname = usePathname();
  const onYear = (year: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("year", String(year));
    yearRouter.replace(`${yearPathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    hasClientHydrated = true;
    try {
      const stored = window.sessionStorage.getItem("hyp3-mode");
      if (stored === "season" || stored === "tournament") {
        setGapMode((curr) => (curr === stored ? curr : stored));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (skipFirstModeWrite.current) {
      skipFirstModeWrite.current = false;
      return;
    }
    try {
      window.sessionStorage.setItem("hyp3-mode", gapMode);
    } catch {
      // ignore
    }
  }, [gapMode]);

  const projectedTeams = useMemo(
    () => dataset.teams.map((t) => projectTeamForMode(t, gapMode)),
    [dataset.teams, gapMode]
  );

  const filteredTeams = useMemo(() => {
    const tagRegion = projectedTeams.filter((t) => {
      if (!selectedTags.has(t.story_tag)) return false;
      if (selectedRegion !== "all" && t.region !== selectedRegion) return false;
      return true;
    });
    return applyRoundFilter(tagRegion, selectedRound);
  }, [projectedTeams, selectedTags, selectedRegion, selectedRound]);

  const counts = useMemo(() => tagCounts(projectedTeams), [projectedTeams]);
  const scale = useMemo(() => maxAbsGap(projectedTeams), [projectedTeams]);

  // Divergent view interpolates between each team's tournament and season gap,
  // so it needs the ORIGINAL team objects (both endpoints) rather than the
  // mode-projected ones. Membership still follows the discrete mode's story_tag
  // so filters and counts stay coherent across the morph.
  const filteredOriginalTeams = useMemo(() => {
    const tagRegion = dataset.teams.filter((t) => {
      const tag = projectTeamForMode(t, gapMode).story_tag;
      if (!selectedTags.has(tag)) return false;
      if (selectedRegion !== "all" && t.region !== selectedRegion) return false;
      return true;
    });
    return applyRoundFilter(tagRegion, selectedRound);
  }, [dataset.teams, gapMode, selectedTags, selectedRegion, selectedRound]);

  // Axis scale spans BOTH modes so bars don't rescale mid-scrub (the
  // full-dataset anchoring rule, extended across the morph).
  const gapScale = useMemo(() => {
    let m = 0;
    for (const t of dataset.teams) {
      m = Math.max(m, Math.abs(t.gap), Math.abs(t.season_gap));
    }
    return m || 1;
  }, [dataset.teams]);

  const maxDailyHype = useMemo(() => {
    let m = 0;
    for (const t of dataset.teams)
      for (const d of t.hype_daily) if (d.value > m) m = d.value;
    return m || 1;
  }, [dataset.teams]);
  const windowDates = useMemo(
    () => dataset.teams[0]?.hype_daily.map((d) => d.date) ?? [],
    [dataset.teams]
  );

  const onToggleTag = (tag: StoryTag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
        if (next.size === 0) return new Set(ALL_TAGS);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const onReset = () => {
    setSelectedTags(new Set(ALL_TAGS));
    setSelectedRegion("all");
    setSelectedRound("all");
  };

  const selectTeamByOriginal = (t: Team | null) => {
    if (t === null) {
      setSelectedTeam(null);
      return;
    }
    const original = dataset.teams.find((x) => x.team === t.team) ?? t;
    setSelectedTeam(original);
  };

  // Hide the sticky Filters bar once the footer scrolls into view so the
  // footer reads as the end of the page (no chrome floating over it).
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerInView, setFooterInView] = useState(false);
  useEffect(() => {
    const node = footerRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setFooterInView(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <YearSwapper
          currentYear={dataset.metadata.tournament_year}
          onSwap={setDataset}
        />
        <UrlSync
          selectedTags={selectedTags}
          selectedRegion={selectedRegion}
          selectedRound={selectedRound}
          selectedTeam={selectedTeam}
          gapMode={gapMode}
          betLine={betLine}
          teams={dataset.teams}
          setSelectedTags={setSelectedTags}
          setSelectedRegion={setSelectedRegion}
          setSelectedRound={setSelectedRound}
          setSelectedTeam={setSelectedTeam}
          setGapMode={setGapMode}
          setBetLine={setBetLine}
        />
      </Suspense>

      <TopNav
        dataset={dataset}
        mode={gapMode}
        setMode={setGapMode}
        years={YEARS}
        currentYear={dataset.metadata.tournament_year}
        onYear={onYear}
      />

      <div id="hyp3-content" className="scroll-mt-[var(--hyp3-nav-h,0px)]">
        <Filters
          mode={gapMode}
          setMode={setGapMode}
          selectedTags={selectedTags}
          selectedRegion={selectedRegion}
          selectedRound={selectedRound}
          tagCounts={counts}
          showRoundFilter={view !== "bracket" && view !== "timeline"}
          showScope={false}
          onToggleTag={onToggleTag}
          onSetRegion={setSelectedRegion}
          onSetRound={setSelectedRound}
          onReset={onReset}
          hidden={footerInView}
        />

        {view === "gap" && (
          <GapChart
            teams={filteredOriginalTeams}
            maxAbsGap={gapScale}
            scope={scope}
            onScopeChange={onScope}
            selectedTeam={selectedTeam?.team ?? null}
            onSelect={(t) => selectTeamByOriginal(t)}
          />
        )}

        {view === "scatter" && (
          <ScatterChartView
            teams={filteredTeams}
            value={betLine ?? DEFAULT_LINE}
            onCommit={setBetLine}
            selectedTeam={selectedTeam?.team ?? null}
            onSelect={(t) => selectTeamByOriginal(t)}
          />
        )}

        {view === "timeline" && (
          <TimelineView
            teams={filteredTeams}
            mode={gapMode}
            windowDates={windowDates}
            maxDailyHype={maxDailyHype}
            selectedTeam={selectedTeam?.team ?? null}
            onSelect={(t) => selectTeamByOriginal(t)}
          />
        )}

        {view === "bracket" && (
          <BracketTree
            teams={projectedTeams}
            filteredTeams={filteredTeams}
            selectedRegion={selectedRegion}
            selectedTeam={selectedTeam?.team ?? null}
            onSelect={(t) => selectTeamByOriginal(t)}
          />
        )}
      </div>

      <div ref={footerRef}>
        <Footer data={dataset} />
      </div>

      <TeamSheet
        team={selectedTeam}
        mode={gapMode}
        open={selectedTeam !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTeam(null);
        }}
        hypeWindowStart={dataset.metadata.hype_window_start}
        hypeWindowEnd={dataset.metadata.hype_window_end}
        meta={dataset.metadata}
      />
    </>
  );
}
