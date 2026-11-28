# Changelog

All notable changes to this project are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/), versioning follows [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Basemap switcher (Gelap / Terang / Satelit) — keyless Esri ArcGIS raster tiles, OSM last-resort fallback, choice persisted in `localStorage`
- Analytics panel in the sidebar: monthly case trend (click a bar to filter that month) + hardest-hit provinces (click to search)
- Quick date ranges (7h / 30h / 90h / 1th) and a "+N baru" badge for incidents since the previous visit
- Shareable deep links: `?q=&cat=&from=&to=&tab=&id=` restored on load and kept in sync
- GeoJSON export (QGIS/kepler.gl-ready) next to the CSV exports
- Keyboard shortcuts: `/` focuses search, `Esc` closes overlays
- `province` / `kabupaten` stored in D1 and returned by `/api/data`
- **SPPG ownership & incident linkage**: every SPPG on the map now shows the yayasan/PT/koperasi that runs it when a source names one, plus the poisoning cases that point at it. New `data/sppg_links.json` is built by `scripts/build_sppg_links.py` from the JejakMBG open dataset (CC BY 4.0), matched to SPPG points by kitchen name + regency and to incidents by date + regency
- Dashed "SPPG dituduh" connectors on the map (incident → accused kitchen) with a layer toggle, `?acc=1` deep link and a `SPPG disebut` filter chip
- SPPG popups list the operator, its source article, and the related cases; incident popups name the accused SPPG with match confidence and distance
- JejakMBG attribution (CC BY 4.0) in the Tentang & Data modal; source/issue links moved to GitHub (`exe-zoinx/mbg-monitor`)
- **BGN roster ingestion** (`scripts/fetch_bgn_roster.py` → `data/bgn_sppg_yayasan.json`): the official 315-unit "SPPG Bulan Maret 2025" table, matched to our points by kecamatan/kelurahan, lifts operator coverage from 12 to ~330 SPPG with a citable source URL (+ Wayback copy)
- **Link confidence** on every incident→SPPG link: `100%` when the source names that unit directly, otherwise a score from shared name tokens, distance and rival candidates, shown with a one-line basis (`link_confidence`, `link_basis`)
- Confidence shown in incident popups, feed badges (`SPPG: <nama> · N%`) and SPPG case chips (`N kasus · max%`); Tentang & Data documents the roster source and the scale
- **Honest locations**: `scripts/geocode_schools.py` resolves every incident through school → kelurahan → kecamatan → kabupaten → provinsi (Nominatim, validated against the named kabupaten) and stores `geo_precision`; popups state the level, so a regency centroid no longer reads as a school pin
- `scripts/seed_d1_coords.py` pushes coordinates + precision into D1, matched on `(date, kabupaten, title)` with no re-insert
- Nearby pins fan out on 18/36/54 m rings (grouped within ~66 m) so co-located incidents stay individually clickable

### Changed
- Analytics panel moved above the sidebar search box and starts collapsed everywhere, with a labelled Buka/Tutup pill (44 px row) so the toggle reads as a control on desktop and mobile with a 3-month-vs-previous-3 trend chip, 18 monthly bars, and a top-6 provinces list (rank · kasus · korban · jiwa); floating mobile button relabelled from "Data" to "Analitik"; desktop "Analitik" button added to the map title bar
- SPPG connectors: anchors resolved from the current incident pin (data coords are stale scrape-time values), deduped, dark casing + brighter purple dashes + endpoint dot, drawn on a dedicated SVG renderer so they stay visible over the 7.6k SPPG canvas; active incident highlighted
- Search now covers province, kabupaten, school name and the multi-school `schools_list`
- Stats row shows school venues affected (multi-school rows expanded)
- Ownership is evidence-based: BGN names a yayasan for 315 units (≈330 of our 7.642 points after matching); the rest show nothing rather than a guessed owner
- Sidebar list is progressively rendered (150 rows per page, append on scroll) instead of fixed-height virtualization — content-sized rows (owner + case chips) no longer overlap

### Fixed
- **Map tiles**: CARTO started answering unkeyed clients with an "API key required" placeholder tile, so every tile was identical. Replaced with keyless Esri tiles
- Victim parsing: `"370 Siswa + 28 Guru"` was parsed as `37028`; ranges are now averaged, sums added
- Incident dedup keys on the victim totals instead of the per-school reference URL, so multi-school outbreaks are no longer counted once per school
- Geocoding matches regency names without the `Kabupaten`/`Kota` prefix; a refresh now completes in seconds (Nominatim is cache-only unless `--net`)
- Sidebar rows overlapped once owner chips were added: fixed `INC_ITEM_H`/`SPPG_ITEM_H` no longer matched real row height
- GitLab project hosting, LICENSE (MIT), CONTRIBUTING.md, README.id.md (Bahasa Indonesia), GitLab CI/CD pipeline
- **Coordinates**: old pins were a rounded regency centroid plus a fixed ~133 m pseudo-random offset — 104 incident pairs sat exactly 133 m apart and 12 incidents were 60–236 km outside their own kabupaten

### Data
- Reseeded D1 from Wikipedia: **520 incidents**, **51.362 korban**, 3 fatalities, coverage through **24 Nov 2026** (was 377 incidents through 31 Jul 2026)
- `data/sppg_links.json`: 74 SPPG matched to cases (25 at 100%, 7 at 60–79, 45 below 60), operators from `bgn_roster` 315 / `article` 12

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
