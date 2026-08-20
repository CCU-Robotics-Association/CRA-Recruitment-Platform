DROP TRIGGER IF EXISTS trg_application_profile_insert;
DROP TRIGGER IF EXISTS trg_application_profile_update;

CREATE TRIGGER trg_application_profile_insert
BEFORE INSERT ON applications
WHEN NEW.gender IS NULL
  OR NEW.gender NOT IN ('male', 'female')
  OR NEW.college IS NULL
  OR NEW.college NOT IN ('计算机科学技术学院', '电子信息工程学院', '数学与统计学院')
BEGIN
  SELECT RAISE(ABORT, 'application profile is invalid');
END;

CREATE TRIGGER trg_application_profile_update
BEFORE UPDATE OF gender, college ON applications
WHEN NEW.gender IS NULL
  OR NEW.gender NOT IN ('male', 'female')
  OR NEW.college IS NULL
  OR NEW.college NOT IN ('计算机科学技术学院', '电子信息工程学院', '数学与统计学院')
BEGIN
  SELECT RAISE(ABORT, 'application profile is invalid');
END;
