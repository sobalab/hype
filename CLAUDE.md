# HYP3 — project memory

A 72-hour capstone project visualizing the gap between Google-Trends hype and 2026 NCAA tournament performance. This file documents conventions, decisions, and gotchas that aren't obvious from the code. Read before touching anything; update when conventions change.

## Stack (locked — do not suggest alternatives)

- Python (offline) + pytrends + pandas — data pipeline
- Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui — web app
- shadcn chart wrapper around Recharts — area chart in team detail sheet
- Vercel — hosting
- Data flow: Python → `data/<year>.json` (committed) → Next.js bundles `data/2026.json` at build time. **No backend, no runtime API.** (Multi-year data exists on disk; the web app currently bundles only 2026.)

## Directory layout

```
data-pipeline/   pull_trends.py, build_dataset.py, tournament_results_<year>.csv, venv/
data/            <year>.json (committed; one file per tournament year)
web/             Next.js app. See web/CLAUDE.md for Next 16 quirks.
```

## Data pipeline — non-obvious decisions

### Cross-batch normalization (Flag 1 — non-negotiable)

Google Trends scores 0–100 are normalized **within a single query**, so values from different batches are not directly comparable. The pipeline anchors every batch with a reference team (Michigan), pulls a dedicated baseline curve once, then rescales every other team:

```
normalized[d] = (team_in_batch[d] / ref_in_batch[d]) * ref_baseline[d]
```

Done per-day so the time-series shape is preserved. Lives in [data-pipeline/pull_trends.py](data-pipeline/pull_trends.py) — `normalize_team_against_baseline()`.

If `ref_in_batch[d]` is 0, that day is set to 0 with a `[zero-ref]` warning. If more than 3 days are zero-ref for a team, a `[LOUD FLAG]` warning fires for manual review.

The reference team is passed via `--reference` (defaults to `"Michigan"` for 2026 backward compat). The pipeline hard-fails if the reference isn't in the year's `tournament_results_<year>.csv` — pick a different reference deliberately for each year, never auto-pick.

**Reference team selection rule:** the reference must have a non-zero baseline on every day of the hype window. If the baseline collapses to zero on any day, the in-batch denominator goes to zero and the cross-batch math explodes — producing 4-digit hype values for teams that should be in the 0-200 range (the McNeese-2025 incident: see commit history for 2026-05-03). The eventual champion is usually the safest pick because their search volume sustains across the entire window. For 2025, Auburn (overall #1 seed) had two zero-baseline days and was unusable; Florida (champion) had a min-baseline of 3 across the same window and worked cleanly. **Before kicking off a full pull for a new year, do a standalone single-team probe of your candidate reference and verify min > 0:**

```python
from pytrends.request import TrendReq
p = TrendReq(hl="en-US", tz=360)
p.build_payload(["Florida Gators basketball"], cat=0, timeframe="2025-03-11 2025-03-25", geo="US")
df = p.interest_over_time().drop(columns=["isPartial"], errors="ignore")
print(df.iloc[:, 0].min())  # must be > 0
```

If min == 0, pick another team. For unfinished tournaments (no champion yet), use a 1-seed with sustained pre-tournament hype that you've spot-checked has min > 0.

The probe is automated as [data-pipeline/probe_reference.py](data-pipeline/probe_reference.py). Run it before kicking off a tournament-mode pull for any new year:

```
./venv/bin/python probe_reference.py --year YYYY --team "Florida" --mode tournament
```

Exits 0 (pass), 1 (min == 0, hard fail), or 2 (min > 0 but ≥5 sub-5 days, soft warn). On non-zero exit, prints a list of year-round national programs to try as alternates.

### Season mode is standalone, not cross-batch

Season mode (`pull_trends.py --mode season`) does **not** use cross-batch normalization. The 4.5-month season window has too many sub-integer-resolution days — even Duke, Florida, Kentucky, UNC, Kansas, and Michigan all have ≥38 zero-baseline days when probed over `2025-11-01:2026-03-24` (verified empirically on 2026-05-10). Cross-batch math depends on `ref_in_batch[d] > 0` every day; over 6 months that's unattainable.

Instead, season mode pulls each team **standalone** (one keyword per pytrends call, no reference, no normalization). Each team's `season_hype_daily` is a 0-100 curve normalized within the team's own history — intra-team comparable but **NOT cross-team comparable in absolute magnitude**.

Consumers of season-mode data must treat values as intra-team only:
- `hype_acceleration` is `(in-window mean) / max(pre-window mean, ε=1.0)` — both sides on the same intra-team scale, so the ratio is meaningful.
- `season_hype_daily` is rendered one team at a time in the team detail sheet — no cross-team comparison.
- `season_hype_normalized` (mean of season curve, scaled 0-100 across the field) is fuzzy by construction; treat as a soft sort key, not an editorial number.

The `--reference` flag is silently ignored in season mode. Probe `probe_reference.py --mode season` is now mostly informational (no team is "the" anchor) but still useful as a sanity check on a candidate team's signal density.

### Query string disambiguation (Flag 2)

The naive query "Texas basketball" picks up football noise, "Michigan basketball" picks up state news, etc. But "Texas Longhorns basketball" works while "Saint Mary's Gaels basketball" returns **all zeros** because the long mascot phrase has no Trends index. The rule learned the hard way:

- **Keep the mascot** for state-name and common-word teams (Texas, Houston, Florida, Kansas, Michigan, Tennessee, Alabama, etc.) — risk is contamination
- **Drop the mascot** for unique-name small/mid schools (St. John's, McNeese, Furman, Hofstra, Siena, etc.) — risk is zero signal
- **Always strip apostrophes and periods** in queries — "St. John's" → `"St Johns basketball"`, "Saint Mary's" → `"Saint Marys basketball"`. Apostrophes break Trends.
- **Use the colloquial school name when ambiguous with another famous school** — Penn → `"Penn Quakers basketball"` (not "Pennsylvania Quakers", which collides with Penn State and the state of Pennsylvania)
- **Special cases discovered the hard way:**
  - Hofstra → `"Hofstra University basketball"` (bare "Hofstra basketball" picks up the famous debate venue)
  - Siena → `"Siena College basketball"` (bare "Siena basketball" picks up Italian city / Sienna brand)
  - LIU (Long Island) → `"LIU basketball"` (school rebranded from Blackbirds to Sharks; "LIU" is the searchable form)
  - McNeese → `"McNeese basketball"` (school dropped "State" branding in 2023)
  - Tennessee State → `"Tennessee State University basketball"` (bare "Tennessee State basketball" bleeds Tennessee Vols / state news; baseline 19-33 on quiet days vs. 0 with the suffix. Mascot variant `"Tennessee State Tigers basketball"` returns near-zero — Tigers is too generic across NCAA programs)

The full disambiguated map is `TEAM_QUERY_MAP` at the top of [pull_trends.py](data-pipeline/pull_trends.py). Keys must match the team name in `tournament_results_<year>.csv` exactly. The map is shared across years — if a team appears in multiple years' CSVs, one entry covers all of them.

### Cache is by team, baseline is separate

[data-pipeline/cache/raw_trends_<year>.json](data-pipeline/cache/) (gitignored) keys by team. Re-runs only re-query missing teams. The reference baseline lives separately under `cache["baseline"]` and is only re-pulled if the cache file is deleted entirely.

**Season-mode caches and outputs do not share with tournament-mode siblings.** Season mode writes `cache/raw_trends_season_<year>.json` and `raw_hype_season_<year>.csv` — clearing one does not invalidate the other. Season caches have no `baseline` entry (standalone pulls don't need one).

To force a re-pull of one team (e.g. after changing its query string):

```python
import json
from pathlib import Path
p = Path("cache/raw_trends_2026.json")            # tournament mode
# p = Path("cache/raw_trends_season_2026.json")   # season mode
c = json.loads(p.read_text())
c["teams"].pop("TeamName", None)
p.write_text(json.dumps(c, indent=2))
```

### `min` rank for performance, not `dense`

`build_dataset.py` uses `method="min"` for `performance_rank` ([build_dataset.py:136](data-pipeline/build_dataset.py:136)). This was a deliberate fix — `dense` rank crushes 33 tied 0-win teams to a single rank value, compresses `performance_rank` to 1–7 (only 7 distinct win counts), and breaks the gap arithmetic so that `gap < -20` is mathematically impossible. Min-rank gives the 33 zero-win teams `performance_rank = 33`, restoring meaningful gap values.

### Asymmetric story_tag thresholds

`overhyped <= -15`, `underhyped > +25` (not symmetric). The asymmetry reflects the same 0-win cluster: with 33 teams tied at performance rank 33, the underhyped side fills up easily with low-hype-low-performance noise. Tighter `+25` filters that noise. Overhyped `<= -15` (originally `< -20`, then `< -15`, finally `<= -15` on 2026-05-03) lets the marquee 1-seed-flame-out story land in the right bucket — Florida sat at gap=-15 exactly, and inclusive `<=` was the smallest change that captured it.

Edit at [data-pipeline/build_dataset.py:69](data-pipeline/build_dataset.py:69) if the distribution feels wrong.

### `hype_raw` math

`hype_raw` is the **mean of unrounded daily values**. Rounding happens at output time only. Don't pre-aggregate in `pull_trends.py` — `raw_hype_<year>.csv` only contains `team` + `hype_daily` (the daily series); `build_dataset.py` computes the mean.

### Performance: tournament vs. season

Performance has a parallel structure to hype:

| Hype | Performance |
|---|---|
| `hype_raw` (15-day window, cross-batch normalized) | `wins` (tournament wins 0-7) |
| `season_hype_raw` (standalone-pull, intra-team) | `season_wins` (overall season W from NCAA API standings) |
| `hype_acceleration` (in-window mean ÷ pre-window mean of season_hype_daily) | `performance_acceleration` (tournament win % ÷ pre-tournament win %) |
| `hype_rank` / `gap` / `story_tag` (tournament-anchored) | `performance_rank` / `gap` / `story_tag` (tournament-anchored — UNCHANGED, drives editorial homepage) |
| `season_hype_rank` | `season_performance_rank` (rank by `season_win_pct`, `method="min"`) |
| — | `season_gap` = `season_hype_rank − season_performance_rank` |
| — | `season_story_tag` (separate thresholds — see below) |

`season_wins` / `season_losses` come from the NCAA API standings endpoint via [fetch_season_records.py](data-pipeline/fetch_season_records.py). They are **overall** — they include the NCAA tournament wins/losses. This is symmetric with `season_hype_raw`, which is also a full-season measure (the tournament window sits inside the season window). To get the regular-season slice, subtract:

- `pre_tournament_wins = season_wins - wins`
- `pre_tournament_losses = season_losses - tournament_losses` (where `tournament_losses = 0` for the champion, else `1`)

Stored fields cover both partitions so consumers can pick the right one for the story.

### Performance acceleration formula

```
performance_acceleration = (wins / (wins + tournament_losses))
                         / (pre_tournament_wins / (pre_tournament_wins + pre_tournament_losses))
```

NO epsilon floor — every D1 tournament team has > 25 pre-tournament games and a pre-tournament win rate above ~0.5, so the denominator can't approach zero. The validator's range check (`0 ≤ accel ≤ 5`) catches NaN if data ever gets corrupted.

### Season-anchored story_tag thresholds

Tuned 2026-05-10 from the 2026 distribution:

- `overhyped`: `season_gap <= -20`
- `underhyped`: `season_gap >= +20`
- `as_expected`: `|season_gap| <= 10`
- `noise`: `10 < |season_gap| < 20`

Symmetric (unlike tournament-side ±15 / ±25). The tournament asymmetry was driven by the 33-team 0-win cluster collapsing `performance_rank` — that doesn't exist on the season side where every team has a distinct win-rate rank. The 2026 distribution shape: 22 as_expected / 20 overhyped / 19 underhyped / 7 noise. Retune for future years if the distribution drifts.

### `season_hype_raw` and `hype_acceleration`

`season_hype_raw` is the same math as `hype_raw` but on the standalone season curve (`raw_hype_season_<year>.csv`) — mean of unrounded daily values, rounded once at output. `season_hype_normalized` scales it to 0-100 across the field, but on its OWN scale (separate `max` from `hype_normalized`), because the underlying values are not cross-team comparable in magnitude.

`hype_acceleration` is computed entirely from `season_hype_daily` (NOT from `hype_raw`) so numerator and denominator share the same intra-team standalone scale:

```
hype_acceleration = mean(season_hype_daily where date ∈ tournament window)
                  / max(mean(season_hype_daily where date < tournament window), ε)
```

with `ε = 1.0` (`ACCELERATION_EPSILON` in [build_dataset.py](data-pipeline/build_dataset.py)). The ε floor prevents the ratio from blowing up when a mid-major has near-zero pre-tournament search volume — the resulting numbers stay readable (no 4-digit acceleration values cluttering the editorial framing). Don't mix `hype_raw` (cross-batch normalized scale) with the season denominator (standalone scale) — they're on different scales and the ratio is meaningless.

### First Four placeholders

`tournament_results_<year>.csv` may contain 4 placeholder rows (`First Four Loser N`) when the bracket is fetched before the First Four games complete. `build_dataset.py` automatically skips rows starting with "First Four Loser". Once filled with real team names, add 4 entries to `TEAM_QUERY_MAP` and rerun the pipeline; the cache will only query the new teams. (Note: `fetch_bracket.py` fills these from the NCAA API automatically — no placeholders unless the bracket is fetched mid-tournament.)

### Logos and the seoname map

`fetch_bracket.py` writes `cache/seonames_<year>.json` (a `{canonical_team_name: seoname_slug}` dict) alongside the CSV. This is the bridge between two downstream consumers:

- `fetch_logos.py` reads the seoname map and downloads `https://ncaa-api.henrygd.me/logo/<slug>.svg` into `web/public/logos/<slug>.svg`. Skips files that already exist locally (re-runs are cheap). Logs and continues on 404.
- `build_dataset.py` reads the seoname map and sets `logo_path: "/logos/<slug>.svg"` per team in `data.json`, but **only if the SVG file actually exists on disk** — else `logo_path: null`. This means `build_dataset.py` is robust to running without `fetch_logos.py` (logo_path is just null for everyone) and robust to logos that 404'd during fetch.

`web/public/logos/` IS committed (1.3 MB of SVGs for 68 teams). Vercel serves them as static assets. The frontend doesn't currently consume `logo_path` — the field exists for future UI work without forcing another pipeline run.

### First Four win counting

**Every `isWinner: true` counts toward a team's `wins` total, including First Four wins** — a play-in win is a tournament win regardless of what happens next. Texas (FF win + 2 main bracket wins = 3 wins) and Howard (FF win, lost in R64 = 1 win) both have their FF wins credited.

This was discovered via NCAA API cross-validation on 2026-05-03: the manually-transcribed 2026 CSV had Howard, Miami (OH), and Prairie View A&M all at `wins=0` (FF wins not counted), while Texas was at `wins=3` (FF win counted). The API counts uniformly. The 2026 CSV was corrected to match — three teams bumped from 0 to 1 wins. This shifted 9 teams' `story_tag` and properly tagged Florida as `overhyped` (it had been `noise` due to the threshold landing exactly at the previous gap value).

Going forward, `fetch_bracket.py` writes uniform API counts and the manual transcription path is deprecated.

## Frontend — non-obvious decisions

### Build-time data import (Flag 3)

Year datasets live at `/data/<year>.json` (outside the Next.js app at `/web`). Importing across the boundary is fragile in production. The fix is `predev` and `prebuild` scripts in [web/package.json](web/package.json) that `cp ../data/2026.json ./data.json` before each dev/build, plus a `tsconfig.json` path alias `@/* → ./*` so [lib/data.ts](web/lib/data.ts) can `import raw from "@/data.json"`.

The web app's import target is `web/data.json` regardless of which year is bundled — only the SOURCE path (`../data/2026.json`) changes if the bundled year ever changes. `web/data.json` is gitignored — it's a build artifact, not a source.

For Vercel: enable "Include source files outside of the Root Directory in the Build Step" so the prebuild script can read `../data/<year>.json`.

### Dev server dist dir lives outside iCloud (`.next.nosync`)

The repo sits under `~/Documents`, which macOS syncs to iCloud. iCloud's sync daemon (`bird`) evicts/relocates Next's rapidly-churning **dev** build artifacts mid-write, which corrupts the dev server: `Cannot find module .next/dev/server/middleware-manifest.json`, `ENOENT` on `_buildManifest.js.tmp`, `Persisting failed: Another write batch or compaction is already active`, and `.next/dev` getting deleted the instant a request comes in. It is intermittent and affects **both** Turbopack and webpack dev; production `next build` (one big write, not churn) is unaffected.

The fix: [web/next.config.ts](web/next.config.ts) sets `distDir: ".next.nosync"` when `HYP3_DEV=1`, and the `dev` script in [web/package.json](web/package.json) is `HYP3_DEV=1 next dev`. iCloud skips anything ending in `.nosync`, so dev output stays unsynced and stable. Build and Vercel keep the standard `.next` (env unset). The separate dirs also stop a local `next build` from clobbering a running dev server. `.next.nosync/` is gitignored.

**Do not "simplify" the conditional `distDir` away** — without it the dev server is unusable on any iCloud-synced checkout. If a dev server wedges anyway, the recovery is: kill every `next dev`/`next-server` process (never run two against one dist dir), `rm -rf .next.nosync`, restart a single server.

### File map

| File | Purpose |
|---|---|
| [web/app/page.tsx](web/app/page.tsx) | `/` — server, mounts `<AppShell view="gap">` |
| [web/app/bracket/page.tsx](web/app/bracket/page.tsx) | `/bracket` — server, mounts `<AppShell view="bracket">` |
| [web/app/layout.tsx](web/app/layout.tsx) | Loads fonts + metadata; mounts `FluidBackground`, `IntroLoader`, `FloatingSearch` |
| [web/app/globals.css](web/app/globals.css) | Tailwind theme + dark tokens + `@font-face` (Alpha Lyrae [3D-canvas only] / Neue / FA-1) + the fluid-field, console-nav (`.cn-*`), grid/aurora, and viz-entrance CSS. Body font (Rubik) is loaded via `next/font` in `layout.tsx` |
| [web/lib/data.ts](web/lib/data.ts) | Typed `Dataset`/`Team`/`StoryTag`, `projectTeamForMode`, `TAG_STYLE` tokens |
| [web/components/app-shell.tsx](web/components/app-shell.tsx) | Client shell holding filter/selection/`gapMode`/`scope`/`betLine`/year state + `UrlSync`; `view` prop renders gap/scatter/timeline/bracket |
| [web/components/top-nav.tsx](web/components/top-nav.tsx) | Instrument-console nav: logo glyph + wordmark, YEAR pill, horizontal channel tabs (roman · dot · name), and SYSTEM STATUS / LATENCY readouts. Below `lg` it collapses to a hamburger drawer (logo + ☰ → YEAR + MODE + vertical channel list). Content is inset (`px-5 sm:px-6`) so it clears the corner screws. No scope toggle (filter bar owns it) and no "Channel" label. Landing ("/") = no active channel; optional year-stepper props only |
| [web/components/filters.tsx](web/components/filters.tsx) | `FilterBar` — an **inline** filter strip (story_tag pills + region segmented + round dropdown + tournament/season SCOPE `ModeToggle` + reset). Rendered **inside each chart view, under its header** (not a floating/sticky bar); built once in app-shell and threaded down via a `filterBar` slot (mirrors `lensToggle`). Always-visible from `sm` up; collapses behind a "Filters" toggle below `sm`. `showScope` on for scatter/timeline/bracket, off for divergent (its own in-chart slider); `showRoundFilter` off for timeline/bracket |
| [web/components/gap-chart.tsx](web/components/gap-chart.tsx) | Diverging bars (CSS) + continuous scope-slider morph + `Predict the order`; mounts `SpectrumCurrent` |
| [web/components/{scatter,timeline,bracket}-view.tsx] | 2D/3D lens wrappers: own the toggle, lazy-load the r3f scene |
| [web/components/{scatter-3d,timeline-terrain,bracket-3d}.tsx] | react-three-fiber electric scenes (cloud / terrain / tree) |
| [web/components/spectrum-current.tsx](web/components/spectrum-current.tsx) | 2D canvas electric current on the divergent bars |
| [web/components/gap-predict.tsx](web/components/gap-predict.tsx) | Divergent drag-to-predict mode (framer `Reorder`) → reveal + score |
| [web/components/provenance.tsx](web/components/provenance.tsx) | Hover/tap source-trace popover (used by team-sheet KPIs) |
| [web/components/floating-search.tsx](web/components/floating-search.tsx) | cmd+K palette: team search + "fork the data" commands |
| [web/components/team-sheet.tsx](web/components/team-sheet.tsx) | Team dossier as a **centered modal** (radix Dialog — same primitive `ui/sheet` uses, no new dep; centered card at all sizes, scrolls within 90dvh). Team-name-led centered header + context line, gap callout, 4-col stat grid, season curve. Each KPI source-traced via `Provenance`. (Export is still `TeamSheet`.) |
| [web/lib/use-is-mobile.ts] / [web/lib/use-on-screen.ts] | shared hooks: flash-free media query, IntersectionObserver visibility |

### Filter state is page-local

State (selected tags, selected region, selected team) lives in `<AppShell>` and resets when navigating between `/` and `/bracket`. Intentional simplicity for v1. If users complain, lift to URL search params — that also gives shareable links.

### Bar / meter scaling is anchored to the FULL dataset

When filters narrow the visible teams, bars/meters still scale to `maxAbsGap(allTeams)`, not the filtered subset. Otherwise filtering rescales the visualization and breaks visual comparison across views.

### Brand & typography conventions

The app is **dark** (charcoal surface ramp `--bg #16161a` → `--bg-3`, white-ish ink). The earlier "light mode" is gone.

| Token | Value | Where |
|---|---|---|
| Accent | blue core ramp `--core #1277de` → `--core-bright #72b8ff` | `text-core`/`text-core-bright`. `--brand` aliases `--core-bright` |
| Primary UI font | **Rubik (400/500/700)** | `next/font/google` in `layout.tsx`, `--font-rubik`, preloaded; drives `--font-sans`. Used across the whole interface |
| Logo font | Neue Black | `@font-face` from `TheNeue-Black.woff2`; `--font-display`, auto-applies to `h1`–`h6` and `.font-display`. **Logo / HYP3 wordmark only** — do not use Neue elsewhere |
| 3D canvas labels | Alpha Lyrae Medium (500) | `@font-face` in `globals.css` from `web/public/fonts/AlphaLyrae-Medium.woff2`. **Only** used by the `<canvas>` `ctx.font` in `bracket-3d.tsx` / `timeline-terrain.tsx` (canvas needs a real self-hosted family name); no longer the UI font |
| Mono / labels | FA-1 Regular | `@font-face` from `FA-1-Regular.otf`; `font-mono`, `tracking-normal` |
| Story tag colors | neon-pastel `#f995b6` / `#66e7d8` / `#efecaf` / `#b4b4ef` | `--overhyped/underhyped/as-expected/noise`; per-component `TAG_RGB`/`TAG_COLOR` maps mirror these |
| Live indicator | `--live #ff7a3d` | defined token; no longer used by the nav (the active-channel LED `.cn-led-on` is now blue `--core-bright` to match the nav redesign) |

Charcoal/grid/aurora defaults (`--bg` charcoal, `--grid-opacity 0.8`, `--aurora-intensity 0.15`) live in `:root` (globals.css), which is now the sole source (the dev TweaksPanel that mirrored them has been removed).

### Brand caps

The brand is **HYP3**, always all-caps. Never "Hyp3", "hyp3", "Hype3". Search/replace if a lowercase variant ever lands.

### TAG_STYLE is the single retheming surface

To retheme story_tag colors (or invert which tag is "danger" coded), edit `TAG_STYLE` in [lib/data.ts](web/lib/data.ts). All components consume from there. Three inline color refs that bypass it (rose/sky used as semantic +/− indicators in gap-chart and bracket-grid) are intentional — they encode direction independent of the tag color.

### Two motion registers — do not collapse them

[components/motion/easing.ts](web/components/motion/easing.ts) exports both. `EASING` (cubic `[0.25,0.1,0.25,1]`) is the **editorial** track: body copy, section reveals, anything that must read as credible. `SPRING` (stiffness 120 / damping 18 / mass 1.1) and `SPRING_SNAPPY` are the **playful** track, applied only to: background, chart state transitions, list reorder, the bet interactions. The spring is **additive — never swap `EASING` globally.** Every motion surface has a `prefers-reduced-motion` settled fallback (no pulses/springs/autoplay).

### Fluid background

[components/fluid-background.tsx](web/components/fluid-background.tsx) is an app-wide z-0 layer (blurred drifting blobs that ease toward the cursor) mounted in the root layout. It reads `--aurora-intensity` / `--grid-opacity` (defaults in `:root`) and blooms in on the `hyp3:intro-dismissed` event from the loader. Ambient rAF loops (fluid bg, `spectrum-current`) are **capped to ~30fps** and pause on `visibilitychange` — keep that cap (halves blurred-layer recompositing). (A dev-only `TweaksPanel` that wrote those CSS vars + the `[data-bg-grid]` class live was removed; the vars now take their `:root` defaults.)

### Centered web3 header template (all four views)

Every view's `<header>` follows one centered template: a centered column (`flex flex-col items-center gap-8 text-center md:gap-9`, `mb-12 md:mb-16`) of mono eyebrow (`0X · The …`, `·` separator not `/`) → centered headline (`clamp(24px,3vw,38px)`, `mx-auto max-w-[760px]`) → centered count + a **left-aligned** caption inside the centered block → the per-view control **centered** below (lens toggle on scatter/timeline/bracket; "Predict the order" on divergent; timeline also centers its SORT, bracket its Legend). The lens toggle uses `self-center` so it's content-width + centered (not stretched) at every breakpoint. Spacing is intentionally airy but measured; the same scale is used in the filter bar and the team modal. Keep new/edited headers on this template.

### Four views, one 2D/3D lens convention

The four routes (`/divergent /scatter /timeline /bracket`) each render `<AppShell view=...>`. Scatter/Timeline/Bracket expose a **2D/3D lens toggle** via a `lensToggle` header slot: the wrapper (`*-view.tsx`) owns the toggle and `dynamic(() => …, { ssr: false })`-imports the r3f scene so **three.js never SSRs and is a separate lazy chunk** (loaded only when 3D opens). The electric/3D scenes use raw three via `three/addons` inside r3f. **Divergent has no 3D model on purpose** — it's a 2D editorial chart, so it gets the `SpectrumCurrent` 2D canvas overlay instead.

3D-scene rules (all three): build objects imperatively in a `useMemo` and add/dispose on the scene; clamp `dpr={[1,2]}`; pause render via `frameloop="never"` when `useOnScreen` reports offscreen; reduced motion = static (no autorotate/pulses/reveal). `three`/`@react-three/fiber@9`/`@react-three/drei@10` are locked to React 19.

### Scope is a continuous slider synced to the discrete `gapMode`

Divergent replaces the tournament/season toggle with a 0→1 `scope` slider (`gap-chart.tsx`); app-shell keeps it in lockstep with the global `gapMode` (crossing 0.5 flips the mode, so filters/counts/URL/other views stay coherent). Bars interpolate gap/width/side/color between the two ends via `projectTeamForMode`; the axis scale spans BOTH modes so bars don't rescale mid-scrub. The binary scope toggle lives in the inline **`FilterBar`** (`filters.tsx`, `showScope`), rendered under each chart's header, for scatter/timeline/bracket; it's hidden on divergent (the slider replaces it) and absent from the nav entirely.

### The bet spine + URL portability

Scatter (2D) = **draw your expectation line** (`BetLine {y0,y1}`); it's lifted to app-shell and synced through `UrlSync` as `?line=y0,y1` (a portable, account-free artifact; "Copy bet link" in the bet card). Divergent = **drag-to-predict** (`gap-predict.tsx`, framer `Reorder`) → lock → spring-resort to truth + accuracy score; this is **session-local, not URL-encoded** (the 68-team permutation is too long/filter-dependent). `UrlSync` is the single place that reads/writes search params (`tags/region/round/team/mode/line/year`) — keep all URL state there (it's under a `<Suspense>` for `useSearchParams`).

### Provenance + fork-the-data

Every team-sheet KPI traces to its source/window/transform + `data_pulled_at` via the `Provenance` popover (sourced from `metadata` + documented methodology, mode-aware). The cmd+K palette (`floating-search.tsx`) carries a "Fork the data" command group (download / open raw / copy URL / copy `fetch()`), pointing at `/data/<year>.json`.

### Year stepper is 2026-only for now

The nav year control offers only `YEARS = [2026]` in app-shell (renders as a static readout with one year). 2025 exists on disk but is **tournament-only** (no `season_*` fields, finding "[finding TBD]"), so it's excluded until backfilled — selecting it would empty season mode and `NaN` the season UI. The `?year=` swap mechanism (`YearSwapper`) still works for complete years.

### Responsive + perf conventions

- **No JS breakpoint flash:** use `useIsMobile`/`useMediaQuery` from [lib/use-is-mobile.ts](web/lib/use-is-mobile.ts) (isomorphic layout-effect corrects before paint; initial state `false` matches SSR — do not lazy-init from `window` or it mismatches).
- **Root clips horizontal overflow:** `overflow-x: clip` is on **both** `html` and `body` (clip, not hidden, to preserve sticky nav). Section headers stack the lens toggle below the headline on mobile (`flex-col sm:flex-row`). The nav channel group is full-width-own-line below `lg` so its scroller is container-bounded.
- **Deferred load lever:** `web/data.json` is ~861KB bundled (≈311KB is `season_hype_daily`, used by the team sheet AND the season-mode heatmap). Splitting it out is a wider refactor — left bundled for now.
- **Site-wide `zoom: 0.8`:** the content wrapper in [layout.tsx](web/app/layout.tsx) carries `style={{ zoom: 0.8 }}` so the whole UI renders at the tighter scale the design was tuned at (≈ an 80% browser zoom). It's on the **content wrapper, not `<body>`**, on purpose — the fixed full-viewport `FluidBackground`/`IntroLoader` are siblings and must stay un-zoomed or they'd shrink to 80% and expose gaps. Don't move the zoom up to body/html. (Trade-off: tap targets also scale, so the `min-h-11` 44px targets render ~35px.)

## Common workflows

The pipeline is year-parameterized as of 2026-05-03. Both `pull_trends.py` and `build_dataset.py` REQUIRE `--year`. CSVs, caches, and outputs are all year-suffixed: `tournament_results_<year>.csv`, `cache/raw_trends_<year>.json`, `raw_hype_<year>.csv`, `data/<year>.json`.

`--window` is **optional** (auto-derived from the bracket cache as of 2026-05-04 — see [Hype window auto-derive](#hype-window-auto-derive) below). Pass it explicitly only to override the formula (e.g. for the 2026 backward-compat window).

### Add a team to a year's dataset

1. Add row to `tournament_results_<year>.csv` (e.g. [tournament_results_2026.csv](data-pipeline/tournament_results_2026.csv))
2. Add entry to `TEAM_QUERY_MAP` in [pull_trends.py](data-pipeline/pull_trends.py) (apply Flag 2 rules). The map is shared across years — if a team is in multiple years' CSVs, one entry covers them all.
3. `cd data-pipeline && ./venv/bin/python pull_trends.py --year YYYY` (tournament mode, default; cache skips existing teams, only queries new ones; window auto-derives from bracket cache)
4. `./venv/bin/python pull_trends.py --year YYYY --mode season` (standalone-pull season curves; cache skips existing teams)
5. `./venv/bin/python build_dataset.py --year YYYY`
6. `./venv/bin/python validate_dataset.py --year YYYY` (schema + range + distribution sanity)
7. `cd ../web && npm run dev` (or build)

### Add a year (full pipeline from scratch)

```
cd data-pipeline
./venv/bin/python fetch_bracket.py --year YYYY
./venv/bin/python fetch_season_records.py --year YYYY                                 # NCAA API standings → cache/season_records_YYYY.json
./venv/bin/python probe_reference.py --year YYYY --team "Florida" --mode tournament   # pick a team that scores 0
./venv/bin/python pull_trends.py --year YYYY --reference Florida                      # tournament mode
./venv/bin/python pull_trends.py --year YYYY --mode season                            # season mode (no --reference needed)
./venv/bin/python fetch_logos.py --year YYYY                                          # optional, populates web/public/logos/
./venv/bin/python build_dataset.py --year YYYY
./venv/bin/python validate_dataset.py --year YYYY
cd ../web && npm run build
```

### Refine a team's query

1. Test variants in a Python REPL with the year's reference team as anchor
2. Update `TEAM_QUERY_MAP` entry in [pull_trends.py](data-pipeline/pull_trends.py)
3. Delete that team from `cache/raw_trends_<year>.json` (snippet below)
4. Rerun `pull_trends.py --year YYYY` (re-queries only that team) + `build_dataset.py --year YYYY`

```python
import json
from pathlib import Path
p = Path("cache/raw_trends_2026.json")
c = json.loads(p.read_text())
c["teams"].pop("TeamName", None)
p.write_text(json.dumps(c, indent=2))
```

### Update the editorial finding

Findings are authored, not derived. Edit the `FINDINGS` dict in [data-pipeline/findings.py](data-pipeline/findings.py) — one entry per year, e.g. `2026: "HYPE vs. PERFORMANCE"`. Years not in the dict get `"[finding TBD]"` automatically (rendered italicized + muted in the hero as a visible "still to do" marker).

Then rerun `build_dataset.py --year YYYY` and `cd web && npm run build`.

Do **not** edit `data/<year>.json` directly — `build_dataset.py` regenerates it from CSV + raw_hype + findings.py and will overwrite manual edits. The findings module is the single source of truth.

### Adjust story_tag thresholds

[data-pipeline/build_dataset.py:69](data-pipeline/build_dataset.py:69), then rerun `build_dataset.py --year YYYY`. Print of distribution at the bottom of stdout helps tune.

### Hype window auto-derive (tournament & season)

**Tournament window** formula (as of 2026-05-04): `(Selection Sunday − 5 days) to (Selection Sunday + 9 days)`, 15 days inclusive. Selection Sunday is derived as the Sunday on or before the earliest game's `startDate` in the cached NCAA bracket (`cache/ncaa_bracket_<year>.json`). Helper lives in [fetch_bracket.py](data-pipeline/fetch_bracket.py) as `derive_window_from_bracket()`; `pull_trends.py` (in tournament mode) and `build_dataset.py` (`--window`) call it via `resolve_window()` when no explicit window is provided.

**Season window** formula (as of 2026-05-10): `(prior-year Nov 1) to (Selection Sunday + 9 days)`, ~144 days. Tournament window is a strict subset by construction, which keeps the pre-tournament partition for `hype_acceleration` clean. Helper is `derive_season_window_from_bracket()` in the same file. `pull_trends.py --mode season` and `build_dataset.py --season-window` call it via `resolve_season_window()` when not provided.

**Workflow contract:** `fetch_bracket.py` must run before `pull_trends.py` / `build_dataset.py` if you're relying on auto-derive. If the bracket cache is missing AND `--window`/`--season-window` aren't passed, both scripts hard-fail with a clear "run fetch_bracket.py first" message.

**2026 historical inconsistency:** 2026's window was set on day one of the project (`2026-03-03 to 2026-03-17`) before any methodology was articulated. The auto-derive formula would produce `2026-03-10 to 2026-03-24` for 2026, but we don't reconcile retroactively — re-pulling 2026 would invalidate 68 cached Trends queries and shift the live editorial output. Always pass `--window 2026-03-03:2026-03-17` explicitly when re-running 2026; for any other year, omit `--window` and let auto-derive take over.

### --window format

Always `YYYY-MM-DD:YYYY-MM-DD` (colon-separated). Internal conversion to pytrends' space-separated format happens at the use-site only — the canonical form on the CLI is colon-separated. The auto-derived value goes through the same validator before use, so a malformed bracket cache surfaces as a clear error rather than silent garbage.

- **tournament mode**: `parse_window` rejects anything other than 15 days inclusive.
- **season mode**: `parse_season_window` accepts 60-270 days inclusive (lower bound is sanity, upper bound is pytrends' daily-resolution ceiling).

## Anti-patterns — do not suggest

- **Mascot in queries for low-volume schools** — returns 0. Drop the mascot.
- **Mascot-less queries for state-name schools** — picks up state news, football, weather. Keep the mascot.
- **Apostrophes in query strings** — Trends mishandles them. Strip.
- **`dense` rank for `performance_rank`** — breaks the gap arithmetic. Always `min`.
- **Pre-aggregating `hype_raw` in `pull_trends.py`** — keep daily series only; aggregate in `build_dataset.py` on unrounded values.
- **Importing `data.json` from outside `/web` in production** — use the prebuild copy script.
- **Symmetric story_tag thresholds** — the 33-team 0-win cluster makes the underhyped side too easy.
- **Adding URL search params, search box, or sort controls** without being asked. v1 is intentionally minimal.
- **Mocking dependencies or writing tests** — explicit no-test policy for the 72-hour scope. (`validate_dataset.py` is a schema/range checker, not a test suite.)
- **Lowercase "Hyp3"** — brand is HYP3 caps.
- **Using cross-batch normalization in season mode** — empirically broken on a 6-month window even with the strongest year-round programs as anchors. Season mode pulls each team standalone; treat values as intra-team only.
- **Sharing caches between `--mode tournament` and `--mode season`** — the day grids are different, the math is different, and the team keys would silently collide. Two cache files, two output CSVs, two normalizations.
- **Mixing scales when computing `hype_acceleration`** — both numerator and denominator must come from `season_hype_daily`. Don't divide tournament-mode `hype_raw` by season-mode pre-window mean; they're on different scales.
- **Treating `season_hype_normalized` as cross-team comparable** — it isn't. Each team's standalone curve is normalized within its own history, so the 0-100 scale means different things per team. Use it as a soft sort key only.
- **Adding an ε floor to `performance_acceleration`** — math is bounded by D1 schedule realities (pre-tournament games > 25, win rate > 0.5). No denominator can approach zero. Safety belongs in `validate_dataset.py`, not the formula.
- **Filtering season-mode views by `team.story_tag`** — `app-shell.tsx` projects teams via `projectTeamForMode()` which swaps `gap`/`story_tag` to their `season_*` equivalents on the way to gap-chart/filters. Downstream code reading the ORIGINAL team object (e.g. `team-sheet.tsx`) must reference `season_gap` / `season_story_tag` by name. Don't shortcut through `t.story_tag` in places that need the underlying-mode-aware value.
- **Treating `season_wins` as regular-season-only** — it's the API's `Overall W`, which **includes** the NCAA tournament. Subtract `wins` to get pre-tournament. (Symmetric with `season_hype_raw` which also includes the tournament window inside the season window.)

## Open follow-ups

### Should consider — data quality + setup

- **NCAA API name normalization map will need maintenance over time.** The map in `fetch_bracket.py` translates the API's current branding (e.g. `McNeese`, `Queens (N.C.)`) to our historical CSV form (`McNeese State`, `Queens`). Schools occasionally rebrand: McNeese dropped "State" in 2023, future years' API responses will reflect that. When fetching a new year, watch for a "would be NEW team names" warning and decide whether to add a normalization entry (preserve the historical canonical name) or update `TEAM_QUERY_MAP` keys (adopt the new name). Both are valid; the choice depends on whether you want consistency with prior years' data.

### Nice-to-haves — skip unless time

- **URL search params** so filter state and selected team survive navigation between `/` and `/bracket` (and become shareable links).
- **Sort controls** on the gap chart — by hype, by performance, by region.
- **Hover tooltips** on bars in the gap chart.
- **Search box** for finding a specific team in 64 rows.

(Brand-caps audit: README and code both confirmed clean as of 2026-05-02. Leaving the "Lowercase Hyp3" anti-pattern note above as a future safeguard.)

## Scope discipline

72-hour project. **Do not add features, refactor, or introduce abstractions beyond what was asked.** Three similar lines beats a premature abstraction. No URL params, no search, no test suite, no extra routes, no UI library swaps. If something feels missing, ask before building.
