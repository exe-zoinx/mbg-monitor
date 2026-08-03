# Changelog

All notable changes to this project are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/), versioning follows [SemVer](https://semver.org/).

## [Unreleased]

### Added
- GitLab project hosting, LICENSE (MIT), CONTRIBUTING.md, README.id.md (Bahasa Indonesia), GitLab CI/CD pipeline

## [2026-08-03]

### Fixed
- Production blank page: D1 returns `schools_list` as a JSON string, now parsed to an array in `useIncidents.js`
- D1 API SELECT query now includes `deaths`, `source_url`, `schools_list` columns
- `_headers`/`_redirects` copy plugin source path (was `frontend/`, files at project root) — security headers now deployed
- CARTO attribution one-line rendering (`white-space: nowrap`)
- Transparent CARTO attribution with white text; zoom controls hidden on mobile; last-update shows date + time in local timezone
- Wrangler Pages build output dir (`frontend/dist` → `dist`), cleaned deploy script
- Desktop stats grid compacted: 3 columns, smaller padding/fonts (282px → 134px)

### Changed
- Production D1 database re-synced from `data/wiki_incidents.json`: 377 incidents, 48,399 victims (was stale 183 incidents / 3,731 victims)
- `stats_snapshot` updated with correct totals

## [2026-08-02]

### Added
- Wikipedia scraper rewrite (`scripts/scrape_wiki.py`): MediaWiki API + wikitextparser
- Multi-school incident deduplication — rows sharing `(date, kabupaten, source_url)` merge into one incident with `schools_list`
- Indonesian number formatting (`fmtNum`, `toLocaleString('id-ID')`) across stats, feed, map popups
- First-visit disclaimer modal ("Perhatian") with `localStorage` persistence
- Stats icons (MapPin, AlertTriangle, Skull, Building2, Globe, TrendingUp) via lucide-react
- "Tentang & Data" modal with 12-column CSV export
- Mobile title bar with horizontal stat chips; menu merged into title bar
- Populasi Indonesia + korban-vs-populasi percentage stat

### Fixed
- Wikipedia page updated from redirect stub to `Daftar_kasus_keracunan_massal_makan_siang_gratis`
- Dead `BASELINE` array removed (local data was 401 incidents, now 377 from Wikipedia only)
- Drawer stats grid: 3 columns on desktop, 3 columns on mobile with hidden icons
- CARTO attribution kept bottom-right (tile ToS), not removed

## [2026-05-28] — e574351

### Added
- Interactive map legend, category filter bar, mobile-first responsive layout

## [2026-05-19] — 2478174

### Changed
- Cron scrape pipeline: Wikipedia-only data source

## Earlier history (selected)

- **Scraper expansion**: 7 Indonesian news scrapers (Suara, Okezone, Sindo, Kumparan, Republika, Viva, Merdeka), date-range archive scraping for 2024+
- **Search APIs**: Tavily, Exa, Firecrawl integration with key rotation
- **AI pipeline**: `worker/src/ai-classify.js` for victim extraction and MBG relevance filtering
- **Geocoding**: Photon/OSM geocoding for schools (571/681 with coordinates)
- **Frontend rewrite**: Vite + React + Leaflet (replacing static HTML), lucide-react icons
