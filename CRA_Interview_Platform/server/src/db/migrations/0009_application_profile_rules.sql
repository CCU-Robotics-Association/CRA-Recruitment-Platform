-- 新报名只允许两个学院和男/女性别；旧数据不被改写。
CREATE TRIGGER IF NOT EXISTS trg_application_profile_insert
BEFORE INSERT ON applications
WHEN NEW.gender IS NULL
  OR NEW.gender NOT IN ('male', 'female')
  OR NEW.college IS NULL
  OR NEW.college NOT IN ('计算机科学技术学院', '电子信息工程学院')
BEGIN
  SELECT RAISE(ABORT, 'application profile is invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_application_profile_update
BEFORE UPDATE OF gender, college ON applications
WHEN NEW.gender IS NULL
  OR NEW.gender NOT IN ('male', 'female')
  OR NEW.college IS NULL
  OR NEW.college NOT IN ('计算机科学技术学院', '电子信息工程学院')
BEGIN
  SELECT RAISE(ABORT, 'application profile is invalid');
END;
