-- D1 Schema for MBG Monitor News System
-- Run: wrangler d1 execute mbg_db --file=worker/src/schema.sql

-- News articles from Indonesian sources
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crawl_id INTEGER REFERENCES crawl_log(id) ON DELETE CASCADE,
  date TEXT,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT 'umum',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  content_hash TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_news_date ON news(date DESC);
CREATE INDEX IF NOT EXISTS idx_news_source ON news(source);

-- Crawl log — tracks each cron run
CREATE TABLE IF NOT EXISTS crawl_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crawled_at TEXT NOT NULL DEFAULT (datetime('now')),
  provider TEXT,
  model TEXT,
  duration_ms INTEGER,
  incidents_added INTEGER DEFAULT 0,
  news_added INTEGER DEFAULT 0,
  poisoning_total INTEGER DEFAULT 0,
  victims_total INTEGER DEFAULT 0,
  raw_ok INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_crawl_date ON crawl_log(crawled_at DESC);

-- Incidents — geocoded events for the map (may be populated manually or via future pipeline)
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cat TEXT NOT NULL DEFAULT 'lainnya',
  date TEXT NOT NULL,
  lat REAL,
  lng REAL,
  title TEXT NOT NULL,
  loc TEXT,
  victims INTEGER DEFAULT 0,
  note TEXT,
  source TEXT,
  url TEXT,
  is_baseline INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(date DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_cat ON incidents(cat);

-- Stats snapshot — aggregated stats updated by cron
CREATE TABLE IF NOT EXISTS stats_snapshot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poisoning_incidents INTEGER DEFAULT 0,
  total_victims INTEGER DEFAULT 0,
  victims_note TEXT,
  budget_spent_t REAL,
  budget_note TEXT,
  captured_at TEXT NOT NULL DEFAULT (datetime('now'))
);
