import type { Db } from './db.ts';
import { loadMigrations } from '../db/migrate.ts';

const EXPECTED_SCHEMA_VERSION = loadMigrations().at(-1)?.version ?? 0;

export interface DatabaseReadiness {
  status: 'ready';
  database: 'ok';
  schemaVersion: number;
}

export function checkDatabaseReadiness(db: Db): DatabaseReadiness {
  db.prepare('SELECT 1 AS ok').get();
  const foreignKeys = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number } | undefined;
  if (foreignKeys?.foreign_keys !== 1) throw new Error('SQLite 外键约束未启用');

  const current = db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get() as {
    version: number;
  };
  if (current.version !== EXPECTED_SCHEMA_VERSION) {
    throw new Error(`数据库结构版本不一致：当前 ${current.version}，期望 ${EXPECTED_SCHEMA_VERSION}`);
  }
  return { status: 'ready', database: 'ok', schemaVersion: current.version };
}

export function assertDatabaseIntegrity(db: Db): void {
  const quick = db.prepare('PRAGMA quick_check').all() as Array<Record<string, string>>;
  const messages = quick.flatMap((row) => Object.values(row));
  if (messages.length !== 1 || messages[0] !== 'ok') {
    throw new Error(`SQLite 完整性检查失败：${messages.join('; ') || '未知错误'}`);
  }
  const foreignKeyErrors = db.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeyErrors.length > 0) {
    throw new Error(`SQLite 外键检查失败：发现 ${foreignKeyErrors.length} 条异常`);
  }
  const invalidSlotLinks = (db.prepare(
    `SELECT COUNT(*) AS c
     FROM applications a
     JOIN interview_slots s ON s.id = a.slot_id
     WHERE s.round_id <> a.round_id`,
  ).get() as { c: number }).c;
  if (invalidSlotLinks > 0) throw new Error(`数据库业务一致性检查失败：${invalidSlotLinks} 条报名跨轮次关联时段`);

  const overbookedSlots = (db.prepare(
    `SELECT COUNT(*) AS c FROM interview_slots s
     WHERE (SELECT COUNT(*) FROM applications a WHERE a.slot_id = s.id) > s.capacity`,
  ).get() as { c: number }).c;
  if (overbookedSlots > 0) throw new Error(`数据库业务一致性检查失败：${overbookedSlots} 个面试时段已超额`);
  checkDatabaseReadiness(db);
}
