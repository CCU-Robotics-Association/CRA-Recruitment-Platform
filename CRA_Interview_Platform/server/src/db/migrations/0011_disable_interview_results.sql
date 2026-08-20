-- 平台只负责报名与面试安排，不承载面试结果。
-- 历史列保留用于兼容已存在的数据库，但数据库层拒绝任何新的结果写入。

CREATE TRIGGER interviews_disable_result_insert
BEFORE INSERT ON interviews
FOR EACH ROW
WHEN NEW.status IN ('passed', 'failed', 'waitlisted')
  OR NEW.score IS NOT NULL
  OR NEW.comment IS NOT NULL
  OR NEW.result_published_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'interview results are disabled');
END;

CREATE TRIGGER interviews_disable_result_update
BEFORE UPDATE OF status, score, comment, result_published_at ON interviews
FOR EACH ROW
WHEN NEW.status IN ('passed', 'failed', 'waitlisted')
  OR NEW.score IS NOT OLD.score
  OR NEW.comment IS NOT OLD.comment
  OR NEW.result_published_at IS NOT OLD.result_published_at
BEGIN
  SELECT RAISE(ABORT, 'interview results are disabled');
END;
