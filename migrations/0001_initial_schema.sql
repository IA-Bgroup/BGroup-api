PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  external_subject TEXT UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'staff', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  -- UPDATE時はアプリケーション側で unixepoch() を明示的に設定する。
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_users_status ON users (status);
CREATE INDEX idx_users_created_at ON users (created_at DESC);
