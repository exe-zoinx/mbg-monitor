# Spec: mbg-news-system

Scope: feature

# MBG News System — Feature Spec

## Overview
Transform MBG Monitor from a static HTML/Leaflet app into a React + Vite frontend with a Cloudflare Worker backend that automatically scrapes Indonesian news sources, uses Google Gemini AI to parse/categorize articles, and stores results in D1.

## Architecture

### Frontend (Cloudflare Pages)
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + DaisyUI (dark theme)
- **Map**: react-leaflet with marker clusters
- **Data Fetching**: @tanstack/react-query
- **Routing**: react-router-dom

### Backend (Cloudflare Worker)
- **Runtime**: Cloudflare Workers (V8 isolates)
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV
- **Scheduling**: Cloudflare Cron Triggers (every 2 hours)
- **AI**: Google Gemini API (@google/generative-ai)

## Database Schema

### `news` table
```sql
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  source TEXT NOT NULL,
  url TEXT UNIQUE,
  published_at TEXT,
  category TEXT CHECK(category IN ('keracunan','sppg','kecelakaan','tewas','lainnya')),
  location TEXT,
  province TEXT,
  lat REAL,
  lng REAL,
  victims INTEGER DEFAULT 0,
  ai_analysis TEXT,           -- raw Gemini JSON response
  scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
  content_hash TEXT UNIQUE,   -- SHA-256 of url+title for dedup
  is_relevant INTEGER DEFAULT 1
);
CREATE INDEX idx_news_source ON news(source);
CREATE INDEX idx_news_published ON news(published_at DESC);
CREATE INDEX idx_news_category ON news(category);
```

### `incidents` table (existing, preserved)
```sql
-- Existing table: id, cat, date, lat, lng, title, loc, victims, note, source, is_baseline
-- Keep as-is, new incidents derived from news table
```

### `crawl_log` table
```sql
CREATE TABLE IF NOT EXISTS crawl_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  articles_found INTEGER DEFAULT 0,
  articles_stored INTEGER DEFAULT 0,
  articles_skipped INTEGER DEFAULT 0,
  errors TEXT,
  status TEXT CHECK(status IN ('running','completed','failed')) DEFAULT 'running'
);
CREATE INDEX idx_crawl_log_source ON crawl_log(source);
```

### `stats_snapshot` table (existing, preserved)

## News Sources & Scraping Strategy

| Source | URL | Method |
|--------|-----|--------|
| Kompas | kompas.com | RSS feed + HTML fallback |
| Detik | detik.com | RSS feed |
| Tempo | tempo.co | RSS feed |
| CNN Indonesia | cnnindonesia.com | RSS feed |
| Tribunnews | tribunnews.com | RSS feed |
| Antara News | antaranews.com | RSS feed |

All sources primarily scraped via their RSS/Atom feeds for reliability. HTMLRewriter used as fallback.

## AI Parsing Pipeline (Gemini)

### Prompt Structure
Send article title + first 2000 chars of content to Gemini with structured output:

```json
{
  "is_mbg_related": true/false,
  "category": "keracunan|sppg|kecelakaan|tewas|lainnya|not_mbg",
  "location": "extracted location string",
  "province": "Indonesian province",
  "lat": estimated_lat_or_null,
  "lng": estimated_lng_or_null,
  "victims": estimated_count_or_0,
  "summary": "1-2 sentence summary in Indonesian"
}
```

### Categorization Rules
- `keracunan`: Food poisoning, mass illness from MBG meals
- `sppg`: SPPG facility issues, logistics, supply problems
- `kecelakaan`: Transport accidents during MBG distribution
- `tewas`: Deaths related to MBG program
- `lainnya`: Other MBG-related incidents
- `not_mbg`: Article not related to MBG (discarded)

## API Endpoints

### Public (CORS enabled)
- `GET /api/news?page=1&limit=20&category=keracunan` — paginated news
- `GET /api/incidents` — all incidents for map display
- `GET /api/stats` — aggregated statistics
- `GET /api/sources` — source health status

### Protected (requires cron secret)
- `POST /api/crawl` — trigger manual crawl
- `GET /api/crawl-status` — detailed crawl log

## Frontend Components

```
src/
├── main.tsx
├── App.tsx
├── components/
│   ├── Layout.tsx           — App shell with sidebar + main area
│   ├── Sidebar.tsx          — Left sidebar container
│   ├── TopBar.tsx           — Logo, live indicator, connection status
│   ├── StatsGrid.tsx        — 4-stat grid (incidents, victims, poisoning, other)
│   ├── SearchBar.tsx        — Debounced search input
│   ├── FilterTabs.tsx       — Category filter buttons with counts
│   ├── NewsFeed.tsx         — Scrollable incident/news list
│   ├── NewsItem.tsx         — Single news/incident card
│   ├── Ticker.tsx           — Scrolling news ticker
│   ├── MapView.tsx          — Leaflet map with marker clusters
│   ├── MapOverlay.tsx       — Map stats overlay
│   ├── MapLegend.tsx        — Category color legend
│   ├── IncidentPopup.tsx    — Leaflet popup content
│   └── ui/                  — Shared DaisyUI-based components
├── hooks/
│   ├── useNews.ts           — News data fetching with react-query
│   ├── useIncidents.ts      — Incident data fetching
│   ├── useStats.ts          — Statistics fetching
│   └── useSearch.ts         — Search/filter state
├── lib/
│   ├── api.ts               — API client (fetch wrappers)
│   ├── constants.ts         — Colors, categories, labels
│   └── utils.ts             — Formatting, date, geo helpers
└── styles/
    └── index.css            — Tailwind directives + custom styles
```

## Environment Variables

### Worker (.dev.vars / wrangler secrets)
- `GEMINI_API_KEY` — Google AI Studio API key
- `CRAWL_SECRET` — Secret for protected endpoints
- `D1_DATABASE_ID` — D1 binding (via wrangler.toml)

### Pages (wrangler pages secret)
- `API_WORKER_URL` — URL of the deployed Worker API

## Build & Deploy Commands

```bash
# Development
npm run dev              # Vite dev server (frontend only, proxy to worker)
npm run dev:worker       # Wrangler dev for worker

# Production
npm run build            # Build React app to dist/
npm run deploy           # Deploy Pages + Worker
npm run deploy:worker    # Deploy worker only
npm run deploy:pages     # Deploy pages only

# Utilities
npm run lint             # ESLint
npm run typecheck        # TypeScript check
npm run seed             # Seed D1 with baseline incidents
```

## Cron Schedule
- **Frequency**: Every 2 hours (`0 */2 * * *`)
- **Timeout**: 30 seconds per source (180s total budget per run)
- **Retry**: Failed sources retried on next scheduled run
- **Dedup**: content_hash prevents duplicate storage

## Acceptance Criteria
1. React frontend renders identically to current HTML version (dark theme, map, sidebar)
2. Cron job successfully scrapes all 6 Indonesian news sources
3. Gemini AI correctly categorizes MBG-related articles (>80% accuracy)
4. News articles appear in frontend feed within 2 hours of publication
5. Map markers display for news articles with extracted coordinates
6. Search and category filtering work on both incidents and news
7. Mobile responsive (sidebar toggles on small screens)
8. All API endpoints return correct CORS headers
9. Crawl log shows source-by-source status
10. No duplicate articles stored (dedup by content_hash)