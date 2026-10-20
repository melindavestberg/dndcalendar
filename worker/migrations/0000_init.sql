-- Baseline, inferred from worker/src/types.ts. No-op on the live DB (tables already exist).
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id TEXT NOT NULL,
  join_code TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_members (
  calendar_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  color TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (calendar_id, user_id)
);

CREATE TABLE IF NOT EXISTS availability (
  calendar_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date_ymd TEXT NOT NULL,
  available INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (calendar_id, user_id, date_ymd)
);

CREATE TABLE IF NOT EXISTS disabled_dates (
  calendar_id TEXT NOT NULL,
  date_ymd TEXT NOT NULL,
  reason TEXT,
  disabled_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (calendar_id, date_ymd)
);
