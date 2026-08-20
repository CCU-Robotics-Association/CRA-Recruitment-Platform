ALTER TABLE applications ADD COLUMN gender TEXT
  CHECK (gender IS NULL OR gender IN ('male', 'female', 'other'));
ALTER TABLE applications ADD COLUMN college TEXT;
ALTER TABLE applications ADD COLUMN major TEXT;
ALTER TABLE applications ADD COLUMN grade TEXT;
ALTER TABLE applications ADD COLUMN class_name TEXT;
