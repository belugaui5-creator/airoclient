CREATE TABLE IF NOT EXISTS license_keys (
  key_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  activated_at TEXT
);
