---
plan name: mbg-react-vite
plan description: React Vite + Cron News
plan status: active
---

## Idea
Transform the existing MBG Monitor (Cloudflare Pages static HTML + Leaflet map) into a modern React + Vite application with a Cloudflare Worker backend that uses Cron Triggers to periodically scrape Indonesian news sources (Kompas, Detik, Tempo, CNN Indonesia, Tribun, Antara), parses and categorizes articles using Google Gemini AI, and stores results in Cloudflare D1. The frontend will use DaisyUI + Tailwind CSS for a polished dark-themed UI while preserving the existing Leaflet incident map functionality.

## Implementation
- Step 1: Set up React + Vite project scaffolding — install dependencies (react, react-dom, react-router-dom, tailwindcss, daisyui, react-leaflet, @tanstack/react-query, vite, @vitejs/plugin-react). Create vite.config.js, tailwind.config.js, postcss.config.js, and index.html entry point.
- Step 2: Migrate frontend UI to React components — convert the existing index.html monolith into modular React components: App layout, Sidebar (Stats, Search, FilterTabs, NewsFeed, Ticker), MapView (Leaflet map with marker clusters), IncidentPopup, and shared UI components. Preserve the exact dark theme styling with Tailwind + DaisyUI.
- Step 3: Set up Cloudflare Worker project — create a separate worker directory with wrangler.toml configured for Cron Triggers. Bind D1 database, KV namespace, and Google AI API key as environment variables.
- Step 4: Design and implement D1 database schema — create tables: news (id, title, summary, source, url, published_at, category, location, victims, ai_analysis, scraped_at, content_hash), crawl_log (id, source, started_at, finished_at, articles_found, articles_stored, errors, status). Add indexes on source, published_at, category.
- Step 5: Build news scraper service in Worker — implement HTMLRewriter-based scrapers for each Indonesian source (Kompas, Detik, Tempo, CNN Indonesia, Tribun, Antara). Each scraper fetches RSS feeds or HTML pages, extracts article titles, URLs, dates, and content snippets. Handle rate limiting and error resilience.
- Step 6: Integrate Google Gemini AI for news analysis — create an AI parsing module that sends scraped article content to Gemini API with a structured prompt to: (a) determine if article is MBG-related, (b) categorize into incident types (keracunan, sppg, kecelakaan, tewas, lainnya), (c) extract location/coordinates, (d) estimate victim count, (e) generate summary. Parse structured JSON response.
- Step 7: Implement Cron Trigger handler — create the scheduled event handler that runs the full pipeline: scrape all sources -> deduplicate by content_hash -> send to Gemini for analysis -> store parsed results in D1 -> update crawl_log. Configure cron schedule (e.g., every 2 hours).
- Step 8: Build API endpoints in Worker — create REST endpoints: GET /api/news (paginated news with filters), GET /api/incidents (incident data for map), GET /api/stats (aggregated statistics), GET /api/crawl-status (crawl log). All endpoints support CORS for Vite dev server.
- Step 9: Connect React frontend to Worker API — use @tanstack/react-query to fetch data from Worker API endpoints. Implement real-time data refresh, loading states, error handling. Replace hardcoded BASELINE data with live API data.
- Step 10: Configure build and deployment pipeline — set up Vite build output for Cloudflare Pages deployment. Configure wrangler.toml for both Pages (frontend) and Worker (backend). Add npm scripts for dev, build, preview, deploy. Set up environment variable management.
- Step 11: End-to-end testing and polish — verify news scraping works for all 7 sources, confirm Gemini categorization accuracy, test full UI flow (map markers, sidebar feed, filtering, search), ensure mobile responsiveness, run lint/typecheck.

## Required Specs
<!-- SPECS_START -->
- mbg-news-system
<!-- SPECS_END -->