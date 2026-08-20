CREATE TABLE auth_failures (
  scope             TEXT NOT NULL,
  identifier_key    TEXT NOT NULL,
  failure_count     INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  blocked_until     TEXT,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (scope, identifier_key)
);

CREATE INDEX idx_auth_failures_updated_at ON auth_failures(updated_at);
