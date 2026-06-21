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
  const year = data.metadata.tournament_year;

  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      {/* Ambient glow only — no photo. The app-wide FluidBackground + grid show
          through; a single radial bloom anchors the headline. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute left-1/2 top-[-12%] h-[440px] w-[860px] max-w-[130vw] -translate-x-1/2 rounded-full opacity-50 blur-[100px]"
          style={{
            background:
              "radial-gradient(circle, rgba(18,119,222,0.35), transparent 65%)",
          }}
        />
      </div>

      <div
        className="relative z-[1] mx-auto flex max-w-[1080px] flex-col items-center text-center"
        style={{
          padding:
            "clamp(3.5rem, 9vw, 7rem) clamp(1.25rem, 4vw, 2rem) clamp(3rem, 7vw, 5rem)",
        }}
      >
        <span className="logo-pulse inline-flex max-w-full items-center gap-2 truncate whitespace-nowrap rounded-full border border-brand bg-black/40 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-brand shadow-[0_0_24px_rgba(114,184,255,0.3)] backdrop-blur sm:text-sm sm:tracking-[0.14em]">
          March Madness{" "}
          <span aria-hidden className="size-1.5 rounded-full bg-brand align-middle" />{" "}
          {year} Tournament
        </span>

        <h1
          className="m-0 mt-7 font-display font-bold leading-[1.0] tracking-[-0.02em]"
          style={{ fontSize: "clamp(2.25rem, 9vw, 5.5rem)", overflowWrap: "normal", wordBreak: "keep-all" }}
        >
          <span className="text-ink">HYPE</span>{" "}
          <span className="italic font-normal text-ink">vs.</span>{" "}
          <span
            className="text-core-bright"
            style={{ textShadow: "0 0 60px rgba(114,184,255,0.4)" }}
          >
            PERFORMANCE
          </span>
        </h1>

        <p className="m-0 mt-6 max-w-[620px] text-[17px] leading-[1.6] text-ink lg:text-[19px]">
          HYP3 measures the distance between how loudly the internet talked about
          each team and how far they actually went that season. See how we
          measured {year}.
        </p>

        {/* CTAs as an instrument-console module — console housing + screws,
            a recessed track, and two "channels": the primary wears the active
            cn-sel treatment with a lit LED; the secondary rests unlit. */}
        <div className="mt-9 flex justify-center">
          <div className="cn-console relative rounded-[16px] border border-border-hi px-3 py-2.5">
            <span aria-hidden className="cn-screw" style={{ top: 8, left: 8 }} />
            <span aria-hidden className="cn-screw" style={{ top: 8, right: 8 }} />
            <span aria-hidden className="cn-screw" style={{ bottom: 8, left: 8 }} />
            <span aria-hidden className="cn-screw" style={{ bottom: 8, right: 8 }} />

            <div className="cn-track relative flex flex-wrap items-stretch justify-center gap-1.5 rounded-[12px] p-[5px]">
              <Link
                href="/divergent"
                aria-label="Explore the data"
                className="cn-sel relative z-[1] inline-flex min-h-11 items-center gap-2.5 rounded-[9px] px-4 font-mono text-[12px] uppercase tracking-[0.14em] text-ink transition-transform duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-bright/60 sm:px-5"
              >
                <span aria-hidden className="size-1.5 shrink-0 rounded-full cn-led cn-led-on" />
                Explore the data
                <span aria-hidden className="text-core-bright">→</span>
              </Link>
              <a
                href="#about"
                className="relative z-[1] inline-flex min-h-11 items-center gap-2.5 rounded-[9px] px-4 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-bright/60 sm:px-5"
              >
                <span aria-hidden className="size-1.5 shrink-0 rounded-full cn-led" />
                How it works
              </a>
            </div>
          </div>
        </div>

        {/* The gap axis — the project's core metric, rendered as a spectrum so
            the hero reads as data, not decoration. */}
        <div className="mt-14 w-full max-w-[680px]">
          <div className="mb-2.5 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em]">
            <span className="text-overhyped">← Overhyped</span>
            <span className="text-ink-3">The gap</span>
            <span className="text-underhyped">Underhyped →</span>
          </div>
          <div
            className="h-2 w-full rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--overhyped), var(--noise) 32%, var(--core-bright) 50%, var(--as-expected) 68%, var(--underhyped))",
            }}
          />
        </div>

        {/* Stat row — the live 2026 data. 2×2 on mobile, 4-across on desktop. */}
        <div className="mt-9 grid w-full grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
          <StatCard
            label="Most overhyped"
            value={mostOver?.team ?? "—"}
            sub={mostOver ? `gap ${mostOver.gap}` : "—"}
            color="var(--overhyped)"
          />
          <StatCard
            label="Most underhyped"
            value={mostUnder?.team ?? "—"}
            sub={mostUnder ? `gap +${mostUnder.gap}` : "—"}
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
    <div className="flex h-full flex-col items-center text-center bg-bg-2 p-5 sm:p-6">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] leading-[1.3] text-ink-2 sm:mb-3 sm:text-sm sm:tracking-[0.14em]">
        {label}
      </div>
      <div
        className="mt-1 break-words font-display font-bold leading-[1.1] tracking-[-0.01em]"
        style={{ color, fontSize: "clamp(1.125rem, 2.8vw, 1.875rem)" }}
      >
        {value}
      </div>
      <div className="mt-2 font-mono text-[11px] tracking-[0.06em] text-ink-2 sm:mt-3 sm:text-sm">
        {sub}
      </div>
    </div>
  );
}

// Re-export so the Team type chain stays importable without circular concerns.
export type { Team };
