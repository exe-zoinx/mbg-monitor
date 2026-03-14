# MBG Monitor

Fully serverless incident map for Indonesia's Makan Bergizi Gratis program.
Zero Termux, zero VPS. Everything runs on Cloudflare free tier.

## Architecture

```
Cloudflare Cron Worker (every 6h)
  → AI web search (Gemini Grounding / Perplexity Sonar)
  → sanitize + validate output
  → write D1 + KV

Cloudflare Pages
  → index.html  (Leaflet map, baseline data hardcoded)
  → /api/data   (reads D1, cached 3min at CDN edge)
  → /api/history (admin crawl log, secret-protected)
```

## Free Tier Summary

| Service | Limit | This app uses |
|---|---|---|
| Workers requests | 100K/day | ~4/day (cron) |
| Workers cron jobs | 5 | 1 |
| D1 storage | 5 GB | <10 MB |
| D1 reads | 5M rows/day | ~100/day |
| D1 writes | 100K rows/day | ~50/crawl |
| KV reads | 100K/day | ~10/pageview |
| Pages | Unlimited | — |

No credit card required.

## Files

```
mbg-monitor/
├── schema.sql                     ← run once in D1 console
├── README.md
│
├── worker/
│   ├── wrangler.toml              ← cron schedule + bindings
│   └── src/
│       ├── index.js               ← Worker entry (scheduled + fetch handlers)
│       └── crawl.js               ← AI crawl + sanitize + D1 write
│
└── pages/
    ├── index.html                 ← full-screen Leaflet map
    ├── _headers                   ← CSP + security headers
    ├── _redirects
    └── functions/api/
        ├── data.js                ← GET /api/data
        └── history.js             ← GET /api/history (admin)
```

## Setup (one time)

### 1. Create D1 Database

Dashboard → Workers & Pages → D1 → **Create database** → name: `MBG_DB`

Open database → **Console** → paste `schema.sql` → **Execute**

Verify: `SELECT name FROM sqlite_master WHERE type='table';`
→ Should show: `incidents`, `news`, `crawl_log`, `stats_snapshot`

### 2. Create KV Namespace

Dashboard → Workers & Pages → KV → **Create namespace** → name: `MBG_KV`

### 3. Deploy Worker

```bash
npm install -g wrangler
wrangler login
```

Edit `worker/wrangler.toml` — fill in the two IDs:
```toml
database_id = "paste-your-d1-id-here"   # from step 1
id          = "paste-your-kv-id-here"   # from step 2
```

```bash
cd worker
wrangler deploy
```

Set secrets (never in files):
```bash
wrangler secret put AI_API_KEY
# Paste: AIzaSy... (Google AI Studio key)

wrangler secret put CRON_SECRET
# Paste: any random string, min 32 chars
# Generate: openssl rand -hex 20

wrangler secret put PAGES_ORIGIN
# Paste: https://your-pages-project.pages.dev
```

### 4. Deploy Pages

Push `pages/` folder to GitHub:
```bash
cd pages
git init && git add . && git commit -m "mbg monitor"
git remote add origin https://github.com/USERNAME/mbg-pages.git
git push -u origin main
```

Dashboard → Workers & Pages → Create → Pages → Connect Git
- Build command: *(empty)*
- Output directory: `/`

After deploy, go to **Settings → Functions**:

D1 bindings → Add: variable `DB` → database `MBG_DB`
KV bindings → Add: variable `MBG_KV` → namespace `MBG_KV`

Settings → Environment variables → Add:
- `REFRESH_SECRET` = same value as `CRON_SECRET`

### 5. First crawl

```bash
curl -X POST "https://mbg-cron.YOUR_SUBDOMAIN.workers.dev/trigger" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Response:
```json
{ "ok": true, "incidents_added": 4, "news_added": 7, "crawl_id": 1, "duration_ms": 3800 }
```

After this the cron fires every 6 hours automatically. No more manual steps.

---

## Endpoints

| Endpoint | Auth | Notes |
|---|---|---|
| `GET /api/data` | None | Cached 3min at CDN. Returns incidents + news + stats. |
| `GET /api/history?secret=` | Required | Crawl log + DB aggregate stats. |
| `POST worker/trigger` | Bearer token | Manual crawl. Use `Authorization: Bearer SECRET` header. |
| `GET worker/status` | None | Last crawl info. Cached 5min. |

---

## AI Providers (free)

Change in `wrangler.toml [vars]`:

| AI_PROVIDER | AI_MODEL | Web Search | Free |
|---|---|---|---|
| `google` | `gemini-2.0-flash` ← **recommended** | ✅ Google Grounding | ✅ |
| `openrouter` | `perplexity/sonar:free` | ✅ Perplexity | ✅ |
| `openrouter` | `google/gemma-3-27b-it:free` | ✗ fallback scrape | ✅ |
| `openrouter` | `deepseek/deepseek-chat-v3-0324:free` | ✗ fallback scrape | ✅ |
| `anthropic` | `claude-haiku-4-5-20251001` | ✅ | ✗ paid |

Get Google AI key: https://aistudio.google.com/app/apikey (free, no card)

---

## Security Notes

- Secrets compared with timing-safe HMAC (prevents timing attacks)
- Provider + model validated against strict allowlist (prevents SSRF)
- All AI output sanitized before DB write (type-checked, length-clamped, URL scheme validated)
- CSP headers block inline scripts not in the allow list
- `X-Frame-Options: DENY` prevents clickjacking
- All DB queries use parameterized statements
- `/api/history` is auth-protected
- Worker `/trigger` requires `Authorization: Bearer` header (not URL param recommended for production)
