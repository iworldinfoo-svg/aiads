-- AI Ad Video Studio - SQLite schema (foundation).
-- This is the canonical schema used by the running Node+SQLite app.
-- For the production PHP/MySQL target, see README "MySQL port" notes:
--   - TEXT -> VARCHAR/TEXT, INTEGER booleans -> TINYINT(1),
--   - REAL -> DECIMAL(10,4), AUTOINCREMENT -> AUTO_INCREMENT,
--   - add FK constraints and indexes as noted.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mobile        TEXT UNIQUE,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
  password_hash TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_slots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_key      TEXT UNIQUE NOT NULL,            -- primary_video|fallback_video|image_gen|tamil_tts|lip_sync
  display_name  TEXT NOT NULL,
  endpoint_url  TEXT,
  api_key_enc   TEXT,                            -- AES-256-CBC encrypted server-side
  cost_per_unit REAL NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 0,      -- 0|1
  test_status   TEXT DEFAULT 'untested',         -- ok|fail|untested
  test_note     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER,
  mobile            TEXT,
  master_prompt     TEXT,
  duration          INTEGER DEFAULT 30,
  strictness        TEXT DEFAULT 'standard',      -- standard|high|maximum
  continuity_score  INTEGER DEFAULT 0,
  credit_estimate   REAL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'draft',-- draft|pending_approval|generating|qc|ready|failed|delivered
  is_trial          INTEGER NOT NULL DEFAULT 0,
  output_path       TEXT,
  preview_path      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL UNIQUE,
  payload     TEXT NOT NULL,                      -- full wizard answers JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER,
  kind        TEXT NOT NULL,                      -- logo|base_image|generated_image|character_photo|endcard_image
  path        TEXT NOT NULL,
  meta        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS characters (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL,
  role         TEXT NOT NULL,                     -- speaker1|speaker2
  source       TEXT,                              -- ai|user_photo|shop_owner
  sheet_path   TEXT,                              -- character sheet SVG/PNG
  attrs        TEXT,                              -- JSON: age, outfit, expression, gestures
  approved     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scenes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        INTEGER NOT NULL,
  idx             INTEGER NOT NULL,
  beat            TEXT,                           -- hook|intro|benefit|offer|cta
  prompt          TEXT,
  poster_path     TEXT,
  last_frame_path TEXT,
  continuity_score INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'pending',         -- pending|rendering|done|failed
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL,
  step        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',     -- queued|running|done|failed
  attempts    INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS credits_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  order_id    INTEGER,
  delta       REAL NOT NULL,
  balance     REAL NOT NULL DEFAULT 0,
  reason      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trials (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  mobile      TEXT NOT NULL,
  otp_hash    TEXT,
  otp_sent_at TEXT,
  verified    INTEGER NOT NULL DEFAULT 0,
  order_id    INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,                      -- category_config|dialogue|style_preview
  key         TEXT NOT NULL,
  title       TEXT,
  body        TEXT NOT NULL,                      -- JSON or text
  lang        TEXT DEFAULT 'ta',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  level       TEXT NOT NULL DEFAULT 'info',        -- info|warn|error
  message     TEXT NOT NULL,
  context     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT UNIQUE NOT NULL,
  value       TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_order ON answers(order_id);
CREATE INDEX IF NOT EXISTS idx_assets_order ON assets(order_id);
CREATE INDEX IF NOT EXISTS idx_characters_order ON characters(order_id);
CREATE INDEX IF NOT EXISTS idx_scenes_order ON scenes(order_id);
CREATE INDEX IF NOT EXISTS idx_jobs_order ON jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_trials_mobile ON trials(mobile);
CREATE INDEX IF NOT EXISTS idx_credits_user ON credits_ledger(user_id);
