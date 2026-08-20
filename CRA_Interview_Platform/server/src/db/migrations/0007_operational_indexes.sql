CREATE INDEX IF NOT EXISTS idx_audit_entity_created
  ON audit_logs(entity, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_actor_created
  ON audit_logs(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_round_created
  ON applications(round_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interviews_status_updated
  ON interviews(status, updated_at DESC);
