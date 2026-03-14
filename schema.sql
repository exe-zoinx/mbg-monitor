-- MBG Monitor — Cloudflare D1 Schema
-- Run once: paste into Cloudflare Dashboard → D1 → your database → Console → Execute

CREATE TABLE IF NOT EXISTS incidents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ext_id      TEXT    UNIQUE NOT NULL,
  cat         TEXT    NOT NULL CHECK(cat IN ('keracunan','sppg','kecelakaan','tewas','lainnya')),
  date        TEXT    NOT NULL,
  lat         REAL,
  lng         REAL,
  title       TEXT    NOT NULL,
  loc         TEXT    NOT NULL,
  victims     INTEGER NOT NULL DEFAULT 0 CHECK(victims >= 0),
  note        TEXT    NOT NULL DEFAULT '',
  source      TEXT    NOT NULL DEFAULT '',
  is_baseline INTEGER NOT NULL DEFAULT 0 CHECK(is_baseline IN (0,1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inc_date ON incidents(date DESC);
CREATE INDEX IF NOT EXISTS idx_inc_cat  ON incidents(cat);
CREATE INDEX IF NOT EXISTS idx_inc_map  ON incidents(lat, lng) WHERE lat IS NOT NULL;

CREATE TABLE IF NOT EXISTS news (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  crawl_id   INTEGER REFERENCES crawl_log(id) ON DELETE CASCADE,
  date       TEXT,
  headline   TEXT    NOT NULL,
  summary    TEXT    NOT NULL DEFAULT '',
  source     TEXT    NOT NULL DEFAULT '',
  url        TEXT    NOT NULL DEFAULT '',
  tag        TEXT    NOT NULL DEFAULT 'umum' CHECK(tag IN ('keracunan','anggaran','umum')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_news_date    ON news(date DESC);
CREATE INDEX IF NOT EXISTS idx_news_crawl   ON news(crawl_id);

CREATE TABLE IF NOT EXISTS crawl_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  crawled_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  provider        TEXT    NOT NULL DEFAULT '',
  model           TEXT    NOT NULL DEFAULT '',
  duration_ms     INTEGER NOT NULL DEFAULT 0,
  incidents_added INTEGER NOT NULL DEFAULT 0,
  news_added      INTEGER NOT NULL DEFAULT 0,
  poisoning_total INTEGER,
  victims_total   INTEGER,
  budget_spent_t  REAL,
  budget_note     TEXT    NOT NULL DEFAULT '',
  raw_ok          INTEGER NOT NULL DEFAULT 1 CHECK(raw_ok IN (0,1))
);

CREATE TABLE IF NOT EXISTS stats_snapshot (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  crawl_id            INTEGER REFERENCES crawl_log(id) ON DELETE CASCADE,
  poisoning_incidents INTEGER,
  total_victims       INTEGER,
  victims_note        TEXT    NOT NULL DEFAULT '',
  budget_spent_t      REAL,
  budget_note         TEXT    NOT NULL DEFAULT '',
  captured_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_snap_crawl ON stats_snapshot(crawl_id);
