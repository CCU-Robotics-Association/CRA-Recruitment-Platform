-- 002 面试管理：为已通过审核的报名（applications）建立 1:1 面试记录。
-- 面试状态（status）由管理端统一流转；评分/评语仅在“结果已发布”后对候选人可见。
-- 面试时段沿用 applications.slot_id（管理端可调整），不在此表冗余存储。

CREATE TABLE interviews (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id      INTEGER NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  status              TEXT    NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'completed', 'no_show', 'passed', 'failed', 'waitlisted')),
  score               INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  comment             TEXT,
  result_published_at TEXT,
  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL
);

CREATE INDEX idx_interviews_status ON interviews(status);
CREATE INDEX idx_interviews_application ON interviews(application_id);
