-- 只保留最新的开放轮次，并在数据库层强制最多一个轮次处于开放状态。
UPDATE recruitment_rounds
SET is_open = 0, updated_at = CURRENT_TIMESTAMP
WHERE is_open = 1
  AND id <> (SELECT MAX(id) FROM recruitment_rounds WHERE is_open = 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rounds_single_open
  ON recruitment_rounds(is_open)
  WHERE is_open = 1;

-- 报名所选时段必须存在、启用且属于同一轮次。
CREATE TRIGGER IF NOT EXISTS trg_application_slot_valid_insert
BEFORE INSERT ON applications
WHEN NEW.slot_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM interview_slots s
  WHERE s.id = NEW.slot_id AND s.round_id = NEW.round_id AND s.is_enabled = 1
)
BEGIN
  SELECT RAISE(ABORT, 'application slot is invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_application_slot_valid_update
BEFORE UPDATE OF slot_id, round_id ON applications
WHEN NEW.slot_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM interview_slots s
  WHERE s.id = NEW.slot_id AND s.round_id = NEW.round_id AND s.is_enabled = 1
)
BEGIN
  SELECT RAISE(ABORT, 'application slot is invalid');
END;

-- 即使绕过服务层，新增或改约也不能超过时段容量。
CREATE TRIGGER IF NOT EXISTS trg_application_capacity_insert
BEFORE INSERT ON applications
WHEN NEW.slot_id IS NOT NULL AND
  (SELECT COUNT(*) FROM applications WHERE slot_id = NEW.slot_id) >=
  (SELECT capacity FROM interview_slots WHERE id = NEW.slot_id)
BEGIN
  SELECT RAISE(ABORT, 'interview slot capacity exceeded');
END;

CREATE TRIGGER IF NOT EXISTS trg_application_capacity_update
BEFORE UPDATE OF slot_id ON applications
WHEN NEW.slot_id IS NOT NULL AND NEW.slot_id IS NOT OLD.slot_id AND
  (SELECT COUNT(*) FROM applications WHERE slot_id = NEW.slot_id) >=
  (SELECT capacity FROM interview_slots WHERE id = NEW.slot_id)
BEGIN
  SELECT RAISE(ABORT, 'interview slot capacity exceeded');
END;

CREATE TRIGGER IF NOT EXISTS trg_slot_capacity_not_below_booked
BEFORE UPDATE OF capacity ON interview_slots
WHEN NEW.capacity < (SELECT COUNT(*) FROM applications WHERE slot_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'slot capacity cannot be below booked count');
END;
