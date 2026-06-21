"use client";

import type React from "react";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Icon } from "@/components/icon";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How is hype measured?",
    a: "We pull daily Google Trends search interest for each team two ways. Tournament mode looks at the 15-day window around Selection Sunday. Trends scores are 0 to 100 within a single query, so values from different queries aren't directly comparable. We fix that by anchoring each batch of teams to a reference team (a year-round national program with reliable signal) and rescaling every other curve against the anchor's standalone curve, so the field is comparable. Season mode looks at the full season (roughly Nov 1 through Selection Sunday + 9 days) and pulls each team standalone, normalized within the team's own history. That makes season values comparable to a team's own past but not to other teams in absolute magnitude. Either way, a team's hype is the mean of its daily series.",
  },
  {
    q: "What does the gap mean?",
    a: "Every team has a hype rank (1 is most searched) and a performance rank (1 is most tournament wins). Gap = hype_rank minus performance_rank. Negative means more attention than wins (overhyped). Positive means more wins than attention (underhyped). Around zero means the internet got it right.",
  },
  {
    q: "What counts as overhyped or underhyped?",
    a: "In tournament mode, overhyped is gap ≤ -15 and underhyped is gap ≥ +25. Anything inside ±10 is as_expected. The rest is noise. The cutoffs are asymmetric because 33 teams in the field share the same performance rank (everyone with zero tournament wins), which compresses the underhyped side. Season mode uses symmetric ±20 thresholds because every team has a distinct win rate.",
  },
  {
    q: "Why these team query strings?",
    a: "Naive queries break in opposite ways. \"Texas basketball\" picks up football noise. \"Saint Mary's Gaels basketball\" returns all zeros because the long mascot phrase has no Trends index. The rule that worked: keep the mascot for common-word names (Texas, Florida, Michigan), drop it for unique school names (St. John's, McNeese). Apostrophes get stripped. The full team-to-query map is committed in pull_trends.py.",
  },
  {
    q: "Tournament mode vs. season mode?",
    a: "Tournament mode uses the 15-day window around Selection Sunday. Season mode uses the full season, roughly Nov 1 through Selection Sunday + 9 days, which includes the tournament itself. Each mode has its own hype rank, performance rank, gap, and story tag. Toggle between them on any chart page.",
  },
  {
    q: "Which years are available?",
    a: "2026 ships bundled with the site. 2025 (Florida's championship year) is also served and loadable via the year query parameter on the data pages. Each year has its own reference team and methodology notes in the repo.",
  },
];

export function AboutSection() {
  return (
    <section
      id="about"
      className="relative border-b border-border bg-bg"
      style={{
        padding:
          "clamp(4rem, 8vw, 6.5rem) clamp(1.25rem, 4vw, 2rem)",
      }}
    >
      <div className="mx-auto flex max-w-[820px] flex-col items-center text-center">
        <div className="mb-5 font-mono text-sm uppercase tracking-[0.18em] text-core-bright">
          About HYP3
        </div>
        <h2
          className="m-0 font-display font-bold leading-[1.4em] tracking-[-0.01em] text-ink"
          style={{ fontSize: "clamp(28px, 4.5vw, 48px)" }}
        >
          We rank every team twice, then{" "}
          <span className="text-core-bright">subtract</span>.
        </h2>
        <div className="mt-10 flex flex-col gap-6">
          <p className="m-0 text-base font-medium leading-relaxed text-white lg:text-[17px]">
            Twitter, ESPN, and Google all settle on a handful of favorites weeks
            before tipoff. The teams that actually win the bracket are usually a
            partial overlap. HYP3 plots both lists for the same 68 teams and
            shows where they don&apos;t match.
          </p>
          <p className="m-0 text-base font-medium leading-relaxed text-white lg:text-[17px]">
            For each team, we pull daily Google Trends search interest two ways:
            across the 15-day window around Selection Sunday (tournament mode),
            and across the full season from Nov 1 onward (season mode). Rank the
            field by hype, then again by wins, and the difference is the gap.
            Negative means overhyped. Positive means underhyped. Zero means the
            internet got it right.
          </p>
        </div>
      </div>
    </section>
  );
}

export function FAQSection() {
  return (
    <section
      id="faqs"
      className="relative border-b border-border bg-bg-1"
      style={{
        padding:
          "clamp(4rem, 8vw, 6.5rem) clamp(1.25rem, 4vw, 2rem)",
      }}
    >
      <div className="mx-auto max-w-[860px]">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 font-mono text-sm uppercase tracking-[0.18em] text-core-bright">
            FAQs
          </div>
          <h2
            className="m-0 font-display font-bold leading-[1.4em] tracking-[-0.01em] text-ink"
            style={{ fontSize: "clamp(28px, 4.5vw, 48px)" }}
          >
            Questions, answered.
          </h2>
        </div>
        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-black/30">
          {FAQS.map((item, i) => (
            <FAQItem
              key={item.q}
              q={item.q}
              a={item.a}
              isLast={i === FAQS.length - 1}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({
  q,
  a,
  isLast,
  defaultOpen = false,
}: {
  q: string;
  a: string;
  isLast: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={isLast ? "" : "border-b border-border"}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)] sm:px-7"
      >
        <span className="font-display text-[16px] font-bold leading-[1.3] tracking-[-0.005em] text-ink sm:text-[18px]">
          {q}
        </span>
        <ChevronDown
          aria-hidden
          className={`size-5 shrink-0 text-ink-2 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-5 pb-6 sm:px-7">
          <p className="m-0 max-w-[820px] text-base font-medium leading-[1.65] text-[#D7EBFF]">
            {a}
          </p>
        </div>
      )}
    </div>
  );
}

export function ApiSection() {
  return (
    <section
      id="api"
      className="relative border-b border-border bg-bg"
      style={{
        padding:
          "clamp(4rem, 8vw, 6.5rem) clamp(1.25rem, 4vw, 2rem)",
      }}
    >
      <div className="mx-auto max-w-[900px]">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 font-mono text-sm uppercase tracking-[0.18em] text-core-bright">
            API & Data
          </div>
          <h2
            className="m-0 font-display font-bold leading-[1.4em] tracking-[-0.01em] text-ink"
            style={{ fontSize: "clamp(28px, 4.5vw, 48px)" }}
          >
            The whole dataset is one JSON file.
          </h2>
          <p className="m-0 mt-6 max-w-[640px] font-sans text-base font-medium leading-relaxed text-[#D7EBFF] lg:text-[17px]">
            No backend, no auth, no rate limits. The site bundles the year&apos;s
            file at build time. Fetch it yourself and do whatever you want with
            it, notebook, sketch, dashboard.
          </p>
        </div>

        <div className="mb-8 mt-12 grid grid-cols-1 gap-3">
          <ApiRow
            method="GET"
            path="/data/2026.json"
            note="Bundled with this app."
          />
          <ApiRow
            method="GET"
            path="/data/2025.json"
            note="Florida championship year."
          />
        </div>

        <div className="mb-3 text-center font-mono text-sm uppercase tracking-[0.14em] text-ink-1">
          Schema <Icon name="bullet" size={12} className="mx-2 inline-block align-middle" /> per team
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-black/40">
          <div className="hidden grid-cols-[minmax(160px,200px)_minmax(80px,100px)_1fr] items-baseline gap-4 border-b border-border bg-black/30 px-4 py-2.5 sm:grid">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2">
              Field
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2">
              Type
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2">
              Description
            </span>
          </div>
          <SchemaRow field="team" type="string" desc="School name. Matches the NCAA bracket." />
          <SchemaRow field="seed" type="number" desc="Tournament seed, 1 to 16." />
          <SchemaRow field="region" type="enum" desc="East / West / South / Midwest." />
          <SchemaRow field="wins" type="number" desc="Tournament wins, 0 to 7. First Four wins count." />
          <SchemaRow field="hype_normalized" type="number" desc="Hype index, 0 to 100 across the field." />
          <SchemaRow field="hype_rank" type="number" desc="Rank by hype. 1 is most hyped." />
          <SchemaRow field="performance_rank" type="number" desc="Rank by wins. Tied teams share the lower number." />
          <SchemaRow field="gap" type="number" desc="hype_rank minus performance_rank. Negative is overhyped." />
          <SchemaRow field="story_tag" type="enum" desc="overhyped / underhyped / as_expected / noise." />
          <SchemaRow field="hype_daily" type="array" desc="Daily hype value across the 15-day window." />
          <SchemaRow field="hype_acceleration" type="number" desc="In-window mean over pre-window mean. Above 1 means surging into the tournament." />
          <SchemaRow field="season_*" type="various" desc="Same shape, computed over the full season (Nov 1 through Selection Sunday + 9)." last />
        </div>

        <div className="mt-12 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          <a
            href="https://github.com/baes358/hype"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-core-bright underline decoration-core-bright/40 underline-offset-4 transition-colors hover:decoration-core-bright"
          >
            Full Pipeline
            <Icon name="upright-arrow" size={10} />
          </a>
        </div>
      </div>
    </section>
  );
}

function ApiRow({
  method,
  path,
  note,
}: {
  method: string;
  path: string;
  note: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-black/30 px-4 py-3">
      <span className="rounded-md border border-core-bright/40 bg-[rgba(18,119,222,0.16)] px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-core-bright">
        {method}
      </span>
      <code className="font-mono text-sm text-ink">{path}</code>
      <span className="font-sans text-[15px] font-medium italic leading-[1.5] text-[#D7EBFF]">
        {note}
      </span>
    </div>
  );
}

function SchemaRow({
  field,
  type,
  desc,
  last,
}: {
  field: string;
  type: string;
  desc: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 px-4 py-3 sm:grid sm:grid-cols-[minmax(160px,200px)_minmax(80px,100px)_1fr] sm:items-baseline sm:gap-4 sm:py-2.5 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <div className="flex items-baseline gap-3 sm:contents">
        <code className="font-mono text-[13px] text-core-bright">{field}</code>
        <span className="font-mono text-[13px] text-ink-2">{type}</span>
      </div>
      <span className="font-sans text-sm font-medium leading-[1.5] text-[#D7EBFF]">{desc}</span>
    </div>
  );
}

export function SourcesSection() {
  return (
    <section
      id="sources"
      className="relative border-b border-border bg-bg-1"
      style={{
        padding:
          "clamp(4rem, 8vw, 6.5rem) clamp(1.25rem, 4vw, 2rem)",
      }}
    >
      <div className="mx-auto max-w-[900px]">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 font-mono text-sm uppercase tracking-[0.18em] text-core-bright">
            External Sources
          </div>
          <h2
            className="m-0 font-display font-bold leading-[1.4em] tracking-[-0.01em] text-ink"
            style={{ fontSize: "clamp(28px, 4.5vw, 48px)" }}
          >
            Where the data comes from.
          </h2>
          <p className="m-0 mt-6 max-w-[640px] text-base font-medium leading-relaxed text-[#D7EBFF] lg:text-[17px]">
            Three upstream sources, all cached locally. The live site
            doesn&apos;t hit any of them at request time.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-3">
          <SourceCard
            label="Google Trends"
            href="https://trends.google.com/trends/"
            display="trends.google.com"
            note="Daily search interest per team. Five teams per batch, each batch anchored to a reference team so values stay comparable across batches."
          />
          <SourceCard
            label="pytrends"
            href="https://github.com/GeneralMills/pytrends"
            display="github.com/GeneralMills/pytrends"
            note="Unofficial Google Trends API wrapper. Drives every Trends pull in the pipeline."
          />
          <SourceCard
            label="NCAA bracket + standings"
            href="https://ncaa-api.henrygd.me/"
            display="ncaa-api.henrygd.me"
            note="Third-party wrapper over the public NCAA endpoints. Source for seed, region, tournament wins, and full-season win-loss."
          />
        </div>
      </div>
    </section>
  );
}

function SourceCard({
  label,
  href,
  display,
  note,
}: {
  label: string;
  href: string;
  display: string;
  note: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-black/30 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <span className="shrink-0 self-start rounded-md border border-core-bright/40 bg-[rgba(18,119,222,0.16)] px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-core-bright sm:self-auto">
          {label}
        </span>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 font-mono text-sm text-ink underline decoration-core-bright/40 underline-offset-4 transition-colors hover:decoration-core-bright"
        >
          {display}
          <Icon name="upright-arrow" size={10} />
        </a>
      </div>
      <span className="mt-4 font-sans text-[15px] font-medium leading-[1.5] text-[#D7EBFF]">
        {note}
      </span>
    </div>
  );
}
