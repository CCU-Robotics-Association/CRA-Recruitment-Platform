CREATE TABLE email_verification_challenges (
  id            TEXT PRIMARY KEY,
  purpose       TEXT NOT NULL CHECK (purpose IN ('registration', 'password_reset')),
  target_digest TEXT NOT NULL,
  code_digest   TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 8),
  expires_at    TEXT NOT NULL,
  consumed_at   TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_email_verification_target
  ON email_verification_challenges (purpose, target_digest, created_at DESC);

CREATE INDEX idx_email_verification_expiry
  ON email_verification_challenges (expires_at);
