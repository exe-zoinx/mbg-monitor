# MBG Monitor Pages

Incident map frontend for Indonesia's Makan Bergizi Gratis program.
Fully serverless on Cloudflare Pages free tier.

---

## Project Structure

```
mbg-monitor-pages/               ← Git repo
├── package.json                 ← root scripts: deploy, dev
├── wrangler.toml                ← deploys to Cloudflare Pages
├── index.html                   ← full-screen Leaflet map
├── _headers                     ← CSP + security headers
├── _redirects
└── functions/api/
    ├── data.js                  ← GET /api/data
    └── history.js               ← GET /api/history (admin)
```

Deploys a Cloudflare Pages project with Pages Functions for API endpoints.

---

## One-Time Setup

### 1. Install Wrangler

```bash
npm install          # installs wrangler from root package.json
```

### 2. Create D1 Database

```bash
npx wrangler d1 create MBG_DB
# → prints: database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# Copy this ID — you'll need it in step 4
```

Run the schema (from the worker repo):
```bash
# Assuming you have the worker repo cloned locally
npx wrangler d1 execute MBG_DB --file=path/to/worker/schema.sql
```

Verify:
```bash
npx wrangler d1 execute MBG_DB --command="SELECT name FROM sqlite_master WHERE type='table';"
# → incidents, news, crawl_log, stats_snapshot
```

### 3. Create KV Namespace

```bash
npx wrangler kv namespace create MBG_KV
# → prints: id = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
# Copy this ID too
```

### 4. Configure wrangler.toml

Edit `wrangler.toml`:
```toml
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   # D1 ID from step 2
id          = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"   # KV ID from step 3
```

### 5. Deploy Pages

```bash
npm run deploy
# Output: "Deploying to ... mbg-monitor.pages.dev"
```

Set Pages secret:
```bash
# The secret for /api/history endpoint (same as worker's CRON_SECRET)
npm run secret put REFRESH_SECRET
```

---

## Daily Commands

```bash
npm run dev              # local Pages dev server (http://localhost:8788)
npm run deploy           # deploy Pages
```

---

## Free Tier

| Service | Limit | Usage |
|---|---|---|
| Pages requests | Unlimited | — |
| D1 reads | 5M rows/day | ~100/day |
| KV reads | 100K/day | ~10/pageview |

---

## Endpoints

| Endpoint | Auth | Cache | Notes |
|---|---|---|---|
| `GET /api/data` | None | 3 min CDN | D1 incidents + news + stats |
| `GET /api/history?secret=` | Required | No | Crawl log + DB stats |
