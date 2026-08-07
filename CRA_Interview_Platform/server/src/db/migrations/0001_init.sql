-- 001 初始表结构：用户 / 招募轮次 / 面试时段 / 报名 / 审计日志
-- 所有时间均以 UTC ISO-8601 文本存储（TEXT），展示按 Asia/Shanghai。

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  display_name  TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'reviewer'
                CHECK (role IN ('super_admin', 'admin', 'reviewer')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  token_version INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

CREATE TABLE recruitment_rounds (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  title              TEXT    NOT NULL,
  description        TEXT    NOT NULL DEFAULT '',
  apply_start_at     TEXT    NOT NULL,
  apply_end_at       TEXT    NOT NULL,
  interview_start_at TEXT,
  interview_end_at   TEXT,
  is_open            INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL
);

CREATE TABLE interview_slots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id   INTEGER NOT NULL REFERENCES recruitment_rounds(id) ON DELETE CASCADE,
  starts_at  TEXT    NOT NULL,
  ends_at    TEXT    NOT NULL,
  capacity   INTEGER NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL,
  UNIQUE (round_id, starts_at)
);
CREATE INDEX idx_slots_round ON interview_slots(round_id, starts_at);

CREATE TABLE applications (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id       INTEGER NOT NULL REFERENCES recruitment_rounds(id),
  slot_id        INTEGER REFERENCES interview_slots(id),
  name           TEXT    NOT NULL,
  student_number TEXT    NOT NULL,
  email          TEXT    NOT NULL,
  phone          TEXT    NOT NULL,
  answers        TEXT    NOT NULL, -- JSON 对象：{ placeholderQuestion1: "...", ... }
  query_code     TEXT    NOT NULL UNIQUE,
  status         TEXT    NOT NULL DEFAULT 'submitted'
                 CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'waitlisted')),
  review_note    TEXT,
  reviewed_by    INTEGER REFERENCES users(id),
  reviewed_at    TEXT,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL,
  UNIQUE (round_id, student_number),
  UNIQUE (round_id, email),
  UNIQUE (round_id, phone)
);
CREATE INDEX idx_applications_round ON applications(round_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_slot ON applications(slot_id);
CREATE INDEX idx_applications_created ON applications(created_at DESC);

CREATE TABLE audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   INTEGER,
  actor_name TEXT,
  action     TEXT    NOT NULL,
  entity     TEXT    NOT NULL,
  entity_id  INTEGER,
  detail     TEXT,
  created_at TEXT    NOT NULL
);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
