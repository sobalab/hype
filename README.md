# HYP3

A single-page editorial visualization of the gap between internet hype and tournament performance for the 2026 NCAA Men's Basketball Tournament. The thesis: measure how much the most-loved teams over- or under-performed expectations, then present the finding as a polished editorial chart.

## Stack

| Layer | Tool |
|---|---|
| Hype data | Python + pytrends + pandas (offline, run once per refresh) |
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui |
| Charts | Recharts for the team area chart; CSS for the diverging bars; SVG for the scatter; canvas for the spectrum current |
| 3D | three.js + react-three-fiber + drei — electric scenes behind a 2D/3D lens toggle (scatter / timeline / bracket), lazy-loaded |
| Motion | framer-motion — editorial easing + an additive spring track (see CLAUDE.md "Two motion registers") |
| Hosting | Vercel |
| Data flow | Python script → `data/data.json` (committed) → Next.js imports at build time. No backend, no runtime API. |

## Repo layout

```
hype/
├── data-pipeline/                        Python — pulls hype from Google Trends, builds dataset
│   ├── pull_trends.py                    Trends pull with cross-batch normalization (year-parameterized)
│   ├── build_dataset.py                  Joins CSV + raw hype, computes ranks/gap/story_tag (year-parameterized)
│   ├── tournament_results_<year>.csv     One per tournament year; 68 teams each
│   ├── requirements.txt
│   └── venv/                             (gitignored)
├── data/
│   └── <year>.json                       Canonical dataset, one per year. The web app currently bundles 2026.
└── web/                                  Next.js 16 app
    ├── app/
    │   ├── page.tsx                      / — diverging gap chart
    │   ├── bracket/page.tsx              /bracket — region grid
    │   ├── layout.tsx                    Fonts + global metadata
    │   └── globals.css                   Tailwind theme + custom @font-face
    ├── components/                       App shell + section components
    ├── lib/data.ts                       Typed dataset + color tokens
    └── public/fonts/                     Drop custom font files here
```

## Quick start

### Pull hype + build dataset (existing year)

```bash
cd data-pipeline
# 2026 uses an explicit --window because its window predates the auto-derive
# formula. See the "Adding a tournament year" section below for the
# auto-derived workflow used by every other year.
./venv/bin/python pull_trends.py --year 2026 --window 2026-03-03:2026-03-17            # full pull (uses cache on re-runs)
./venv/bin/python pull_trends.py --year 2026 --window 2026-03-03:2026-03-17 --dry-run  # 3-team smoke test
./venv/bin/python build_dataset.py --year 2026 --window 2026-03-03:2026-03-17          # produces ../data/2026.json + sanity tables
```

`--year` is required. `--window` is optional — if omitted, it's auto-derived from the cached NCAA bracket via the `(Selection Sunday − 5, Selection Sunday + 9)` formula. Pass it explicitly only when you need to override (as 2026 does). `--window` format: `YYYY-MM-DD:YYYY-MM-DD` (colon-separated, exactly 15 days inclusive). `pull_trends.py` also accepts `--reference TEAM` (defaults to `Michigan` for 2026 backward compat).

### Adding a tournament year

Three commands. Each year is independent — adding a new year doesn't touch existing ones.

```bash
cd data-pipeline

# 1. Fetch the bracket from the NCAA API
#    Writes tournament_results_<year>.csv + cache/seonames_<year>.json + cache/ncaa_bracket_<year>.json
./venv/bin/python fetch_bracket.py --year 2027

# 2. Pull Google Trends hype curves for the year (window auto-derived from bracket cache)
./venv/bin/python pull_trends.py --year 2027 --reference Florida

# 3. Build the canonical dataset (writes ../data/2027.json)
./venv/bin/python build_dataset.py --year 2027
```

The only genuinely editorial decision per year is:

- **Reference team** — needs to be a high-search-volume top seed actually in that year's field, with a non-zero search baseline on every day of the window. The eventual champion is the safest pick. The pipeline hard-fails if `--reference` isn't in the CSV, so picking is deliberate, not magical.

The hype window itself is auto-derived from the NCAA API bracket (Selection Sunday − 5 days through Selection Sunday + 9 days, 15 days inclusive). To override — e.g. for the 2026 backward-compat window — pass `--window YYYY-MM-DD:YYYY-MM-DD` explicitly to both `pull_trends.py` and `build_dataset.py`.

**Optional:** `python fetch_logos.py --year 2025` downloads the year's team logo SVGs into `web/public/logos/`. The dataset is functional without it — `logo_path` is set to `null` per team when the SVG isn't on disk — but the logos are nice to have for any future UI work that wants them.

The web UI continues to render only the bundled year (currently 2026). Adding 2025 produces `data/2025.json` for proof-of-concept and demoability without touching the live site.

### Run the web app

```bash
cd web
npm install
npm run dev      # localhost:3000
npm run build    # production build
```

`predev` and `prebuild` scripts copy `data/2026.json` → `web/data.json` so it bundles into the Next.js build. The web app's import target stays at `web/data.json` regardless of which year is bundled — only the source path in [web/package.json](web/package.json) changes if the bundled year ever switches.

`npm run dev` sets `HYP3_DEV=1`, which points the dev build dir to `.next.nosync`. This repo lives under iCloud-synced `~/Documents`, and iCloud corrupts Turbopack's churning dev artifacts; the `.nosync` suffix keeps them unsynced (and stops local `next build` from clobbering a running dev server). Build/Vercel keep the standard `.next`. See CLAUDE.md → "Dev server dist dir lives outside iCloud".

## Editorial system

Each team gets a `story_tag` derived from the gap between its hype rank and its performance rank:

| Tag | Rule | Meaning |
|---|---|---|
| `overhyped` | `gap < -15` | Got more hype than wins justified |
| `underhyped` | `gap > +25` | Performed deeper than the internet noticed |
| `as_expected` | `abs(gap) <= 10` | Hype matched performance |
| `noise` | otherwise | Neither a story nor expected — small school, low signal |

Asymmetric thresholds reflect the structural fact that the underhyped side of the distribution is fed by 33 teams tied at 0 wins, so a tighter cutoff there filters out non-stories.

## Deploy

Vercel auto-deploys on push to `main`. Set Vercel project's **Root Directory** to `web/` so it picks up the Next.js app, and enable "Include source files outside of the Root Directory" so the prebuild script can read `../data/2026.json`.

## Brand

- **Name:** HYP3 (always all caps)
- **Accent:** blue core ramp `#1277de` into `#72b8ff` (centralized as `--core` / `--core-bright` in `web/app/globals.css`)
- **Display font:** Neue Black, logo / HYP3 wordmark only (`web/public/fonts/TheNeue-Black.woff2`)
- **Body / UI font:** Alpha Lyrae Medium, weight 500 (`web/public/fonts/AlphaLyrae-Medium.woff2`)
- **Mono / labels:** FA-1 Regular (drop `web/public/fonts/FA-1-Regular.otf`)
