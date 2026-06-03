"use client";

import { Icon } from "@/components/icon";
import { useReveal } from "@/components/motion/use-reveal";
import { Region, REGIONS, StoryTag, Team } from "@/lib/data";

const TAG_COLOR: Record<StoryTag, string> = {
  overhyped: "#f995b6",
  underhyped: "#66e7d8",
  as_expected: "#efecaf",
  noise: "#b4b4ef",
};

const CANONICAL_SEED_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];

type RegionTree = {
  r64: (Team | null)[];
  r32: (Team | null)[];
  s16: (Team | null)[];
  e8: (Team | null)[];
  champion: Team | null;
};

function pickWinner(a: Team | null, b: Team | null, minWins: number): Team | null {
  if (!a && !b) return null;
  if (!a) return b!.wins >= minWins ? b : null;
  if (!b) return a.wins >= minWins ? a : null;
  if (a.wins >= minWins && b.wins < minWins) return a;
  if (b.wins >= minWins && a.wins < minWins) return b;
  return a.wins >= b.wins ? a : b;
}

function buildRegionTree(allTeams: Team[], region: Region): RegionTree {
  const inRegion = allTeams.filter(
    (t) => t.region === region && t.made_main_bracket
  );
  const bySeed = new Map<number, Team>();
  for (const t of inRegion) bySeed.set(t.seed, t);

  const r64: (Team | null)[] = CANONICAL_SEED_ORDER.map((s) => bySeed.get(s) ?? null);
  const r32: (Team | null)[] = [];
  for (let i = 0; i < 8; i++) r32.push(pickWinner(r64[2 * i], r64[2 * i + 1], 1));
  const s16: (Team | null)[] = [];
  for (let i = 0; i < 4; i++) s16.push(pickWinner(r32[2 * i], r32[2 * i + 1], 2));
  const e8: (Team | null)[] = [];
  for (let i = 0; i < 2; i++) e8.push(pickWinner(s16[2 * i], s16[2 * i + 1], 3));
  const champion = pickWinner(e8[0], e8[1], 4);

  return { r64, r32, s16, e8, champion };
}

type Props = {
  teams: Team[];
  filteredTeams: Team[];
  selectedRegion: Region | "all";
  selectedTeam: string | null;
  onSelect: (team: Team) => void;
};

export function BracketTree({
  teams,
  filteredTeams,
  selectedRegion,
  selectedTeam,
  onSelect,
}: Props) {
  const visibleTagSet = new Set<StoryTag>(filteredTeams.map((t) => t.story_tag));
  const regionsToShow: Region[] =
    selectedRegion === "all" ? REGIONS : [selectedRegion];
  const trees = regionsToShow.map((r) => ({
    region: r,
    tree: buildRegionTree(teams, r),
  }));
  const champion = teams.find((t) => t.wins === 6) ?? null;
  // Region panels (then the Final Four strip) rise in on mount / navigation.
  const revealing = useReveal(1200);

  return (
    <section
      className="relative mx-auto max-w-[1180px]"
      style={{
        padding:
          "clamp(2.5rem, 6vw, 4.5rem) clamp(1.25rem, 4vw, 2rem) clamp(3rem, 7vw, 5rem)",
      }}
    >
      <header className="mb-8 flex flex-col gap-6 md:mb-10 md:gap-8">
        <div className="flex flex-col gap-10 md:gap-12">
          <div>
            <div className="mb-3 font-mono text-sm uppercase tracking-[0.14em] text-ink-2">
              <span className="text-core-bright">04</span> /{" "}
              <span className="text-ink-1">The Bracket</span>
            </div>
            <h2
              className="m-0 max-w-[720px] font-display font-bold leading-[1.4em] tracking-[-0.005em] text-ink"
              style={{ fontSize: "clamp(22px, 2.6vw, 34px)" }}
            >
              Every matchup,{" "}
              <span className="text-core-bright">colored</span> by whether the
              internet got it right
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2.5">
              <span
                className="font-display font-bold leading-none text-ink"
                style={{ fontSize: "clamp(26px, 4.5vw, 36px)" }}
              >
                {teams.length}
              </span>
              <span className="font-mono text-sm uppercase tracking-[0.16em] text-ink-2">
                Teams
              </span>
            </div>
            <p className="m-0 max-w-md text-base leading-[1.6] text-[#D7EBFF]">
              The bracket as it played out, recolored by who was oversold.
            </p>
          </div>
        </div>

        <Legend />
      </header>

      {/* Champion banner — always visible up top so the final result is
          legible without horizontal scrolling through the tree. */}
      {champion && selectedRegion === "all" && (
        <ChampionBanner
          champion={champion}
          onSelect={onSelect}
          selected={selectedTeam === champion.team}
        />
      )}

      <div
        className={`grid gap-4 ${
          regionsToShow.length === 1
            ? "grid-cols-1"
            : "grid-cols-1 xl:grid-cols-2"
        }`}
      >
        {trees.map(({ region, tree }, i) => (
          <RegionTreeCard
            key={region}
            region={region}
            tree={tree}
            visibleTagSet={visibleTagSet}
            selectedTeam={selectedTeam}
            onSelect={onSelect}
            revealDelay={revealing ? i * 90 : null}
          />
        ))}
      </div>

      {selectedRegion === "all" && (
        <FinalStrip
          teams={teams}
          champion={champion}
          visibleTagSet={visibleTagSet}
          selectedTeam={selectedTeam}
          onSelect={onSelect}
          revealDelay={revealing ? trees.length * 90 : null}
        />
      )}
    </section>
  );
}

function ChampionBanner({
  champion,
  onSelect,
  selected,
}: {
  champion: Team;
  onSelect: (team: Team) => void;
  selected: boolean;
}) {
  const color = TAG_COLOR[champion.story_tag];
  return (
    <button
      type="button"
      onClick={() => onSelect(champion)}
      className="mx-auto mb-6 flex w-fit max-w-full flex-col items-center gap-3 rounded-2xl border border-core-bright/40 bg-[rgba(18,119,222,0.10)] px-6 py-4 text-center transition-all hover:bg-[rgba(18,119,222,0.16)] sm:px-10 sm:py-5"
      style={{
        boxShadow: selected
          ? "0 0 0 1px var(--core-bright), 0 0 32px -4px rgba(114,184,255,0.5)"
          : undefined,
      }}
    >
      <span
        className="inline-flex items-center gap-3 font-mono text-sm font-bold uppercase tracking-[0.18em] text-core-bright"
        style={{ textShadow: "0 0 12px rgba(114,184,255,0.6)" }}
      >
        <span aria-hidden className="text-2xl leading-none sm:text-3xl">★</span>
        National Champion
        <span aria-hidden className="text-2xl leading-none sm:text-3xl">★</span>
      </span>

      <span className="flex flex-wrap items-baseline justify-center gap-3">
        <span className="font-mono text-base font-bold tabular-nums text-core-bright sm:text-lg">
          #{String(champion.seed).padStart(2, "0")}
        </span>
        <span
          className="font-display font-bold leading-none text-ink"
          style={{ fontSize: "clamp(22px, 3.6vw, 30px)" }}
        >
          {champion.team}
        </span>
        <span className="font-mono text-sm font-bold tabular-nums text-core-bright">
          GAP {champion.gap > 0 ? `+${champion.gap}` : champion.gap}
        </span>
      </span>

      <span className="inline-flex flex-wrap items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2">
        <span className="text-ink-1">{champion.region} region</span>
        <span
          className="rounded-full border bg-black/40 px-2 py-0.5 font-bold"
          style={{ color, borderColor: `${color}55` }}
        >
          {champion.story_tag === "as_expected"
            ? "AS EXPECTED"
            : champion.story_tag.toUpperCase()}
        </span>
      </span>
    </button>
  );
}

function Legend() {
  return (
    <div className="flex w-full flex-col items-start gap-3 rounded-[10px] border border-border bg-[rgba(255,255,255,0.025)] px-3.5 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
      {(Object.keys(TAG_COLOR) as StoryTag[]).map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1.5"
          style={{ color: TAG_COLOR[tag] }}
        >
          <Icon name="bullet" size={14} color={TAG_COLOR[tag]} className="block shrink-0" />
          <span className="font-mono text-xs uppercase tracking-[0.12em]">
            {tag === "as_expected" ? "As expected" : tag.charAt(0).toUpperCase() + tag.slice(1)}
          </span>
        </span>
      ))}
    </div>
  );
}

function BracketConnector({ inCount, outCount }: { inCount: number; outCount: number }) {
  const paths: string[] = [];
  for (let i = 0; i < outCount; i++) {
    const yTopIn = ((i * 2 + 0.5) / inCount) * 100;
    const yBotIn = ((i * 2 + 1.5) / inCount) * 100;
    const yOut = ((i + 0.5) / outCount) * 100;
    paths.push(`M 0 ${yTopIn} L 50 ${yTopIn}`);
    paths.push(`M 0 ${yBotIn} L 50 ${yBotIn}`);
    paths.push(`M 50 ${yTopIn} L 50 ${yBotIn}`);
    paths.push(`M 50 ${yOut} L 100 ${yOut}`);
  }
  return (
    <svg
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
      className="block size-full"
    >
      <g
        stroke="rgba(114,184,255,0.4)"
        strokeWidth="1"
        fill="none"
        vectorEffect="non-scaling-stroke"
      >
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

type CardProps = {
  team: Team | null;
  selected: boolean;
  dimmed: boolean;
  onSelect: (team: Team) => void;
  large?: boolean;
  highlight?: boolean;
  champion?: boolean;
};

function BracketCard({
  team,
  selected,
  dimmed,
  onSelect,
  large,
  highlight,
  champion,
}: CardProps) {
  if (!team) {
    return (
      <div
        aria-hidden
        className={`w-full rounded-[4px] border border-dashed border-white/[0.05] ${
          large ? "min-h-9 rounded-md" : "min-h-[22px]"
        }`}
      />
    );
  }
  const color = TAG_COLOR[team.story_tag];
  const borderColor = selected ? "var(--core-bright)" : `${color}55`;
  const boxShadow = selected
    ? `0 0 0 1px var(--core-bright), 0 0 24px ${color}66`
    : highlight || champion
    ? `0 0 24px -4px ${color}80`
    : undefined;

  return (
    <button
      type="button"
      onClick={() => onSelect(team)}
      title={`${team.team}, ${team.wins}W (seed ${team.seed})`}
      className={`relative flex w-full cursor-pointer items-center text-left transition-all ${
        large
          ? "gap-2 rounded-md px-2.5 py-2"
          : "gap-1.5 rounded-[4px] px-1.5 py-1"
      }`}
      style={{
        background: champion
          ? "rgba(18,119,222,0.18)"
          : highlight
          ? "rgba(18,119,222,0.12)"
          : "rgba(0,0,0,0.5)",
        borderColor,
        borderWidth: champion ? 1.5 : 1,
        borderStyle: "solid",
        boxShadow,
        opacity: dimmed ? 0.35 : 1,
        minHeight: large ? 38 : 26,
      }}
    >
      <span
        className={`shrink-0 font-mono font-bold tabular-nums leading-none ${
          large ? "text-[11px]" : "text-[10px]"
        }`}
        style={{ color, minWidth: large ? 18 : 14 }}
      >
        {String(team.seed).padStart(2, "0")}
      </span>
      <span
        className={`min-w-0 flex-1 truncate font-sans leading-tight text-ink ${
          large ? "text-[13px]" : "text-[11px]"
        }`}
      >
        {team.team}
      </span>
      {large && (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-core-bright">
          {team.wins}W
        </span>
      )}
    </button>
  );
}

function RegionTreeCard({
  region,
  tree,
  visibleTagSet,
  selectedTeam,
  onSelect,
  revealDelay,
}: {
  region: Region;
  tree: RegionTree;
  visibleTagSet: Set<StoryTag>;
  selectedTeam: string | null;
  onSelect: (team: Team) => void;
  revealDelay: number | null;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-bg-1 ${
        revealDelay != null ? "viz-rise" : ""
      }`}
      style={revealDelay != null ? { animationDelay: `${revealDelay}ms` } : undefined}
    >
      <div className="flex items-center justify-between border-b border-border bg-black/30 px-3.5 py-2.5">
        <span className="font-display text-sm font-bold uppercase tracking-[0.08em] text-ink">
          {region}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-2">
          16 TEAMS
        </span>
      </div>
      <div className="w-full overflow-x-auto">
      <div
        className="grid h-[420px] min-w-[560px] gap-0 px-2.5 py-3 sm:h-[460px] sm:min-w-0 lg:h-[480px]"
        style={{
          gridTemplateColumns:
            "1.4fr 0.5fr 1fr 0.5fr 1fr 0.5fr 1fr 0.5fr 1fr",
        }}
      >
        <div className="flex min-w-0 flex-col justify-around">
          {tree.r64.map((t, i) => (
            <BracketCard
              key={t?.team ?? `r64-${i}`}
              team={t}
              selected={t != null && selectedTeam === t.team}
              dimmed={t != null && !visibleTagSet.has(t.story_tag)}
              onSelect={onSelect}
            />
          ))}
        </div>
        <BracketConnector inCount={16} outCount={8} />
        <div className="flex min-w-0 flex-col justify-around">
          {tree.r32.map((t, i) => (
            <BracketCard
              key={t?.team ?? `r32-${i}`}
              team={t}
              selected={t != null && selectedTeam === t.team}
              dimmed={t != null && !visibleTagSet.has(t.story_tag)}
              onSelect={onSelect}
            />
          ))}
        </div>
        <BracketConnector inCount={8} outCount={4} />
        <div className="flex min-w-0 flex-col justify-around">
          {tree.s16.map((t, i) => (
            <BracketCard
              key={t?.team ?? `s16-${i}`}
              team={t}
              selected={t != null && selectedTeam === t.team}
              dimmed={t != null && !visibleTagSet.has(t.story_tag)}
              onSelect={onSelect}
            />
          ))}
        </div>
        <BracketConnector inCount={4} outCount={2} />
        <div className="flex min-w-0 flex-col justify-around">
          {tree.e8.map((t, i) => (
            <BracketCard
              key={t?.team ?? `e8-${i}`}
              team={t}
              selected={t != null && selectedTeam === t.team}
              dimmed={t != null && !visibleTagSet.has(t.story_tag)}
              onSelect={onSelect}
            />
          ))}
        </div>
        <BracketConnector inCount={2} outCount={1} />
        <div className="flex min-w-0 flex-col justify-center">
          <BracketCard
            team={tree.champion}
            selected={tree.champion != null && selectedTeam === tree.champion.team}
            dimmed={
              tree.champion != null && !visibleTagSet.has(tree.champion.story_tag)
            }
            onSelect={onSelect}
            highlight
          />
        </div>
      </div>
      </div>
    </div>
  );
}

function FinalConnector({ pairs }: { pairs: number }) {
  return (
    <svg
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
      className="block size-full"
    >
      <g
        stroke="rgba(114,184,255,0.45)"
        strokeWidth="0.6"
        strokeDasharray="2.5 3"
        fill="none"
        vectorEffect="non-scaling-stroke"
      >
        {pairs === 2 ? (
          <g>
            <path d="M 0 12.5 L 50 12.5 L 50 37.5 L 100 25 M 0 37.5 L 50 37.5" />
            <path d="M 0 62.5 L 50 62.5 L 50 87.5 L 100 75 M 0 87.5 L 50 87.5" />
          </g>
        ) : (
          <path d="M 0 25 L 50 25 L 50 75 L 0 75 M 50 50 L 100 50" />
        )}
      </g>
    </svg>
  );
}

function FinalStrip({
  teams,
  champion,
  visibleTagSet,
  selectedTeam,
  onSelect,
  revealDelay,
}: {
  teams: Team[];
  champion: Team | null;
  visibleTagSet: Set<StoryTag>;
  selectedTeam: string | null;
  onSelect: (team: Team) => void;
  revealDelay: number | null;
}) {
  const regionalChamps: (Team | null)[] = REGIONS.map(
    (r) => teams.find((t) => t.region === r && t.wins >= 4) ?? null
  );
  if (regionalChamps.every((t) => t == null)) return null;
  const f4Winners = teams.filter((t) => t.wins >= 5).slice(0, 2);

  return (
    <div
      className={`mt-5 rounded-2xl border border-[rgba(114,184,255,0.2)] bg-[rgba(18,119,222,0.04)] p-5 ${
        revealDelay != null ? "viz-rise" : ""
      }`}
      style={revealDelay != null ? { animationDelay: `${revealDelay}ms` } : undefined}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          <span className="text-core-bright">F4</span> / Championship
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-2">
          regional champs → national champion
        </span>
      </div>
      <div className="w-full overflow-x-auto">
      <div
        className="grid min-w-[640px] items-stretch gap-0"
        style={{
          gridTemplateColumns: "1fr 60px 1fr 60px 1fr",
          minHeight: 200,
        }}
      >
        <div className="flex flex-col justify-around gap-2">
          {regionalChamps.map((t, i) => (
            <BracketCard
              key={t?.team ?? `rc-${i}`}
              team={t}
              selected={t != null && selectedTeam === t.team}
              dimmed={t != null && !visibleTagSet.has(t.story_tag)}
              onSelect={onSelect}
              large
            />
          ))}
        </div>
        <FinalConnector pairs={2} />
        <div className="flex flex-col justify-around gap-2">
          {[0, 1].map((i) => (
            <BracketCard
              key={f4Winners[i]?.team ?? `f4-${i}`}
              team={f4Winners[i] ?? null}
              selected={f4Winners[i] != null && selectedTeam === f4Winners[i].team}
              dimmed={
                f4Winners[i] != null && !visibleTagSet.has(f4Winners[i].story_tag)
              }
              onSelect={onSelect}
              large
            />
          ))}
        </div>
        <FinalConnector pairs={1} />
        <div className="flex flex-col justify-center">
          <div className="flex flex-col items-center gap-2">
            <div
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-core-bright"
              style={{ textShadow: "0 0 12px rgba(114,184,255,0.6)" }}
            >
              ★ NATIONAL CHAMPION
            </div>
            <BracketCard
              team={champion}
              selected={champion != null && selectedTeam === champion.team}
              dimmed={champion != null && !visibleTagSet.has(champion.story_tag)}
              onSelect={onSelect}
              large
              champion
            />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
