# 🍱 MBG Monitor

> An independent map tracking reported health incidents linked to Indonesia's
> Makan Bergizi Gratis (MBG) free-meals program.

**Live map: [https://mbg-monitor.pages.dev](https://mbg-monitor.pages.dev)**

**🌏 Read this in [Bahasa Indonesia](README.id.md)**

---

## What is this?

MBG Monitor is an independent map tracking food-poisoning incidents from
Indonesia's **Makan Bergizi Gratis (MBG)** program — the national school-meals
initiative. Data is gathered automatically from **Indonesian media** and
**Wikipedia**, and SPPG kitchen locations come from the Ministry of Agriculture's
public SPPG distribution map.

**The goal is transparency.** By making incident data open and visible, we hope
the public, government, and policymakers can evaluate and improve the MBG
program for a better future.

## Why transparency matters

Programs like MBG touch millions of lives. When incidents happen, they should
be visible, countable, and learnable-from. This map exists so that every
incident is documented — not to attack the program, but to help it get better.

## How it works

```
Wikipedia + media → scraper (Python) → data/wiki_incidents.json → D1 database (Cloudflare)
                                                        ↓
Interactive map (React + Leaflet) ← Cloudflare Pages ← frontend
```

1. **Scraper** (`scripts/scrape_wiki.py`) pulls incident data from Wikipedia's MBG poisoning table
2. **Deduplication** — multi-school incidents merge, victims counted once (48k, not 117k)
3. **Frontend** (React + Vite + Leaflet) renders the map, stats, and incident feed
4. **Deploy** to Cloudflare Pages + D1 for production data
5. **Ownership & culprit links** (`scripts/fetch_bgn_roster.py`, `scripts/build_sppg_links.py`) attach a yayasan/PT to an SPPG only when a source names it — BGN's official *SPPG Bulan Maret 2025* table (315 units, matched by kecamatan/kelurahan) or the cited article. Each incident→SPPG link carries a confidence: **100%** when the source names that unit directly, otherwise a score from shared name tokens, distance and rival candidates. No source, no owner.

## Tech stack

- **Frontend**: React 19, Vite, Leaflet, Tailwind CSS, daisyUI
- **Basemap**: keyless Esri ArcGIS raster tiles (dark / light / satellite) with OpenStreetMap fallback — no API key anywhere
- **Icons**: lucide-react
- **Backend**: Cloudflare Pages Functions + D1 + Workers
- **Data**: Python scraper → JSON → SQLite/D1
- **Hosting**: Cloudflare Pages
- **CI/CD**: GitLab CI (see `.gitlab-ci.yml`)

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` — local data is served from `data/wiki_incidents.json` (no D1 needed).

Refresh the dataset (Wikipedia + media, ~10s):

```bash
uv run --with wikitextparser --with requests python scripts/scrape_wiki.py
# add --net to also resolve school-level coordinates through Nominatim (slow, 1 req/s)
```

## Deploy

```bash
npm run deploy
```

Requires Cloudflare credentials (`wrangler login` or `CLOUDFLARE_API_TOKEN`). Build → upload to Pages → deploy Functions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — setup, conventions, and how to open a merge request.

## License

[MIT](LICENSE) © 2026 Sukma Diki

## Disclaimer

> **This project is part of a transparency effort.** Open data about the MBG
> program helps the public and government evaluate what works and what needs
> fixing — so the program can serve Indonesian children better in the future.

> **Non-affiliation notice:** This project is independent and not affiliated
> with or sponsored by any government agency, ministry, or organization.
- Data is collected automatically from **public media**, **Wikipedia**, and the
  **Ministry of Agriculture's SPPG map**
- Errors, duplicates, or omissions are possible — verify before citing
- This is **not** medical advice, an official report, or a political campaign
- Spotted a wrong incident or missing correction? Open an issue.
