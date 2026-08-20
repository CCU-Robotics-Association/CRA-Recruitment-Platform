-- 平台只承担报名任务：锁死历史审核字段，并禁止继续创建或修改面试记录。
-- 保留旧列和旧表仅用于无损升级已有数据库，不再作为业务能力开放。

CREATE TRIGGER applications_disable_review_insert
BEFORE INSERT ON applications
FOR EACH ROW
WHEN NEW.status <> 'submitted'
  OR NEW.review_note IS NOT NULL
  OR NEW.reviewed_by IS NOT NULL
  OR NEW.reviewed_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'application review is disabled');
END;

CREATE TRIGGER applications_disable_review_update
BEFORE UPDATE OF status, review_note, reviewed_by, reviewed_at ON applications
FOR EACH ROW
WHEN NEW.status IS NOT OLD.status
  OR NEW.review_note IS NOT OLD.review_note
  OR NEW.reviewed_by IS NOT OLD.reviewed_by
  OR NEW.reviewed_at IS NOT OLD.reviewed_at
BEGIN
  SELECT RAISE(ABORT, 'application review is disabled');
END;

CREATE TRIGGER interviews_disable_insert
BEFORE INSERT ON interviews
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'interview management is disabled');
END;

CREATE TRIGGER interviews_disable_update
BEFORE UPDATE ON interviews
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'interview management is disabled');
END;
