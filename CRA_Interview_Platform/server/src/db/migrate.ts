/**
 * 版本化迁移执行器：按文件名序号顺序执行 db/migrations/*.sql，
 * 已应用的版本记录在 schema_migrations 表，可安全重复启动。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import type { Db } from '../lib/db.ts';
import { withTransaction } from '../lib/db.ts';

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations', import.meta.url));

interface MigrationFile {
  version: number;
  name: string;
  sql: string;
  checksum: string;
}

export function loadMigrations(): MigrationFile[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort((a, b) => {
      const va = Number.parseInt(a, 10);
      const vb = Number.parseInt(b, 10);
      return va - vb;
    });

  return files.map((file) => {
    const version = Number.parseInt(file, 10);
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    return {
      version,
      name: file,
      sql,
      checksum: createHash('sha256').update(sql).digest('hex'),
    };
  });
}

export function migrate(db: Db): { applied: number[] } {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT,
      checksum   TEXT,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationColumns = new Set(
    (db.prepare('PRAGMA table_info(schema_migrations)').all() as Array<{ name: string }>).map((column) => column.name),
  );
  if (!migrationColumns.has('name')) db.exec('ALTER TABLE schema_migrations ADD COLUMN name TEXT');
  if (!migrationColumns.has('checksum')) db.exec('ALTER TABLE schema_migrations ADD COLUMN checksum TEXT');

  const appliedRows = db
    .prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version')
    .all() as Array<{ version: number; name: string | null; checksum: string | null }>;
  const applied = new Map(appliedRows.map((row) => [row.version, row]));

  const appliedNow: number[] = [];
  const insert = db.prepare(
    'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)',
  );
  const backfill = db.prepare('UPDATE schema_migrations SET name = ?, checksum = ? WHERE version = ?');

  for (const migration of loadMigrations()) {
    const existing = applied.get(migration.version);
    if (existing) {
      if (existing.checksum && existing.checksum !== migration.checksum) {
        throw new Error(`数据库迁移 ${migration.version} 的校验和与源码不一致，拒绝启动`);
      }
      if (!existing.checksum || !existing.name) backfill.run(migration.name, migration.checksum, migration.version);
      continue;
    }
    withTransaction(db, () => {
      db.exec(migration.sql);
      insert.run(migration.version, migration.name, migration.checksum, new Date().toISOString());
    });
    appliedNow.push(migration.version);
  }

  return { applied: appliedNow };
}
