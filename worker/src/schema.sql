-- D1 Schema for MBG Monitor News System
-- Run: wrangler d1 execute mbg_db --file=worker/src/schema.sql

-- News articles from Indonesian sources
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  headline TEXT NOT NULL,
  summary TEXT,
  source TEXT NOT NULL,
  url TEXT,
  tag TEXT,
  content_hash TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_date ON news(date DESC);
CREATE INDEX IF NOT EXISTS idx_news_hash ON news(content_hash);
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
