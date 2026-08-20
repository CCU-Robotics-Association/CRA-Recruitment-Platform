import type { Db } from './db.ts';
import { nowIso } from './time.ts';

export interface AuditEntry {
  actorId: number | null;
  actorName: string | null;
  action: string;
  entity: string;
  entityId?: number | null;
  detail?: unknown;
  createdAt?: string;
}

export function writeAuditLog(db: Db, entry: AuditEntry): void {
  db.prepare(
    `INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.actorId,
    entry.actorName,
    entry.action,
    entry.entity,
    entry.entityId ?? null,
    entry.detail === undefined ? null : JSON.stringify(entry.detail),
    entry.createdAt ?? nowIso(),
  );
}
