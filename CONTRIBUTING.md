# Contributing to MBG Monitor

Thanks for wanting to contribute! This project tracks food-poisoning incidents from Indonesia's MBG program — every contributor helps keep the data honest and the map accurate.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Ways to contribute](#ways-to-contribute)
- [Project structure](#project-structure)
- [Setting up locally](#setting-up-locally)
- [Working on the scraper](#working-on-the-scraper)
- [Working on the frontend](#working-on-the-frontend)
- [Submission workflow](#submission-workflow)
- [Commit conventions](#commit-conventions)
- [Getting help](#getting-help)

## Code of conduct

Be respectful. This project monitors a government program — contributors may hold strong opinions, but discussions here stay focused on the data and the code. Harassment, trolling, and political flame wars get you removed.

## Ways to contribute

1. **Data corrections** — spotted a wrong victim count, date, or location in `data/wiki_incidents.json`? Open an issue with the source link.
2. **Scraper improvements** — the Wikipedia scraper (`scripts/scrape_wiki.py`) is the data backbone. Better parsing = better data.
3. **Frontend polish** — map UX, accessibility, mobile layout, i18n (English/Indonesian).
4. **CI/CD** — improve the GitLab pipeline, add tests.
5. **Documentation** — README, CHANGELOG, this file.

## Project structure

```
├── frontend/          # React + Vite + Leaflet SPA
│   ├── src/
│   │   ├── components/    # MapView, Sidebar
│   │   ├── hooks/         # useData, useIncidents
│   │   └── lib/           # constants, formatters
├── functions/api/     # Cloudflare Pages Functions (D1-backed API)
├── scripts/           # Python scrapers (Wikipedia, news)
├── worker/            # Cloudflare Worker (cron scraping, AI classification)
├── data/              # wiki_incidents.json (the dataset)
└── docs/              # plans and specs
```

## Setting up locally

Prerequisites: Node.js ≥ 20, npm, Python 3.10+ (for scrapers).

```bash
git clone git@gitlab.com:sukma-diki/mbg-monitor.git
cd mbg-monitor
npm install
npm run dev
```

Open `http://localhost:5173`. Local dev serves `data/wiki_incidents.json` directly — no D1 database or Cloudflare credentials needed.

## Working on the scraper

```bash
python3 scripts/scrape_wiki.py   # regenerates data/wiki_incidents.json
```

Rules:
- **Never commit raw duplicate rows.** Multi-school incidents must merge with `schools_list` (see dedup key `(date, kabupaten, source_url)` in the script).
- **Keep Indonesian number formatting** in notes (`fmt_n` helper).
- After changing the scraper, regenerate the JSON and verify counts change sensibly (current baseline: 377 incidents, 48,399 victims, 2 deaths).

## Working on the frontend

- **Icons**: use `lucide-react` — no Font Awesome, no emoji for UI elements.
- **Number formatting**: use `fmtNum()` / `toLocaleString('id-ID')` — Indonesian thousands separators (`1.000`, not `1,000`).
- **Map attribution**: the CARTO attribution must stay visible (tile ToS). You may restyle it, never remove it.
- **Localization**: new user-facing strings should appear in both English and Indonesian where the UI is bilingual.

## Submission workflow

1. Create a feature branch: `git checkout -b feat/your-change`
2. Make your change, commit (see conventions below)
3. Run a build to confirm nothing breaks:
   ```bash
   npm run build
   ```
4. Push and open a **merge request** against `master`:
   ```bash
   git push origin feat/your-change
   ```
5. In the MR description, state: what changed, why, and how you verified it (screenshot for UI changes).

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add CSV export with Indonesian number formatting
fix: parse schools_list JSON string from D1
refactor: extract number formatter into constants
docs: update README with deployment instructions
chore: clean up unused geocode scripts
```

Keep the subject ≤ 72 characters. Reference issue numbers when relevant: `fix: correct victim count for Kediri incident (#12)`.

## Getting help

- Open an issue on GitLab with the `question` label
- For data disputes, include the source URL (media article or Wikipedia revision)

---

*Made with ❤️ and a healthy dose of skepticism toward free lunch programs.*
