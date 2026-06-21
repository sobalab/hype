import Link from "next/link";

import { Dataset, Team } from "@/lib/data";

type Props = { data: Dataset };

export function Hero({ data }: Props) {
  const teams = data.teams;
  const sortedByGap = [...teams].sort((a, b) => a.gap - b.gap);
  const mostOver = sortedByGap[0];
  const mostUnder = sortedByGap[sortedByGap.length - 1];
  const overCount = teams.filter((t) => t.story_tag === "overhyped").length;
  const underCount = teams.filter((t) => t.story_tag === "underhyped").length;

  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      {/* Crossfading champion photos */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: "url(/media/champ1.png)",
          animation: "hero-fade-a 12s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: "url(/media/champ2.png)",
          animation: "hero-fade-b 12s ease-in-out infinite",
        }}
      />
      {/* Dark overlay — gentle ramp instead of stepped bands so there's no
          visible horizontal seam mid-hero. */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,12,0.72) 0%, rgba(10,10,12,0.58) 45%, rgba(10,10,12,0.88) 95%, var(--bg) 100%)",
        }}
      />
      {/* Bottom fade — tall + early start so the hero blends seamlessly into
          the body --bg below it. Terminal explicitly matches --bg so the
          filter bar sits on the same color. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-[1] h-60"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(10,10,12,0.55) 35%, var(--bg) 85%, var(--bg) 100%)",
        }}
      />
      {/* Dot grid overlay on top of the photo */}
      <div aria-hidden className="bg-dotgrid z-[1]" />

      <div
        className="relative z-[2] mx-auto max-w-[1280px]"
        style={{
          padding:
            "clamp(2.5rem, 8vw, 6rem) clamp(1.25rem, 4vw, 2rem) clamp(4rem, 12vw, 10rem)",
        }}
      >
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <span className="logo-pulse inline-flex max-w-full items-center gap-2 truncate whitespace-nowrap rounded-full border border-brand bg-black/45 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-brand shadow-[0_0_24px_rgba(114,184,255,0.35)] backdrop-blur sm:px-3.5 sm:py-1.5 sm:text-sm sm:tracking-[0.12em]">
            March Madness <span aria-hidden className="mx-1.5 inline-block size-1.5 rounded-full bg-brand align-middle" /> {data.metadata.tournament_year} Tournament
          </span>
        </div>

        <h1
          className="m-0 mb-8 font-display font-bold leading-[1.0] tracking-[-0.02em]"
          style={{ fontSize: "clamp(2rem, 10vw, 5rem)", overflowWrap: "normal", wordBreak: "keep-all" }}
        >
          <span className="text-ink">HYPE</span>{" "}
          <span className="italic font-normal text-ink">vs.</span>{" "}
          <span
            className="text-core-bright"
            style={{ textShadow: "0 0 60px rgba(114,184,255,0.35)" }}
          >
            PERFORMANCE
          </span>
        </h1>

        <p
          className="m-0 mb-10 max-w-3xl leading-snug text-ink lg:mb-14"
          style={{ fontSize: "clamp(1rem, 1.6vw, 1.375rem)" }}
        >
          HYP3 measures the distance between how loudly the internet talked about each team vs. how far they actually went that season.
          See how we measured 2026.{" "}

        </p>

        {/* Primary entry into the default view (Divergent), plus a quiet link to
            the anchored methodology docs further down this page. */}
        <div className="mb-10 flex flex-wrap items-center gap-4 lg:mb-14">
          <Link
            href="/divergent"
            className="inline-flex items-center gap-2 rounded-full bg-core-bright px-6 py-3 font-mono text-[13px] font-medium uppercase tracking-[0.12em] text-black shadow-[0_0_32px_rgba(114,184,255,0.4)] transition-transform hover:-translate-y-px hover:bg-core-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-bright/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Explore the data
            <span aria-hidden>→</span>
          </Link>
          <a
            href="#about"
            className="inline-flex items-center font-mono text-[13px] uppercase tracking-[0.12em] text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            How it works
          </a>
        </div>

        {/* Stat row — 2×2 on mobile, 4-across on desktop. */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
          <StatCard
            label="Most overhyped"
            value={mostOver?.team ?? ","}
            sub={mostOver ? `gap ${mostOver.gap}` : ","}
            color="var(--overhyped)"
          />
          <StatCard
            label="Most underhyped"
            value={mostUnder?.team ?? ","}
            sub={mostUnder ? `gap +${mostUnder.gap}` : ","}
            color="var(--underhyped)"
          />
          <StatCard
            label="Overhyped flameouts"
            value={`${overCount}`}
            sub={`of ${teams.length} teams`}
            color="var(--ink)"
          />
          <StatCard
            label="Underhyped sleepers"
            value={`${underCount}`}
            sub={`of ${teams.length} teams`}
            color="var(--ink)"
          />
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="flex h-full flex-col items-center text-center bg-black/60 p-4 backdrop-blur sm:p-6 lg:p-7">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] leading-[1.3] text-ink-2 sm:mb-3 sm:text-sm sm:tracking-[0.14em]">
        {label}
      </div>
      <div
        className="mt-1 break-words font-display font-bold leading-[1.1] tracking-[-0.01em]"
        style={{
          color,
          fontSize: "clamp(1.125rem, 2.8vw, 1.875rem)",
        }}
      >
        {value}
      </div>
      <div className="mt-2 font-mono text-[11px] tracking-[0.06em] text-ink-2 sm:mt-3 sm:text-sm">
        {sub}
      </div>
    </div>
  );
}

// Unused but exported so other components can import the Team type chain
// without circular concerns when this file is removed in the future.
export type { Team };
