/**
 * 版本化迁移执行器：按文件名序号顺序执行 db/migrations/*.sql，
 * 已应用的版本记录在 schema_migrations 表，可安全重复启动。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from '../lib/db.ts';
import { withTransaction } from '../lib/db.ts';

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations', import.meta.url));

interface MigrationFile {
  version: number;
  name: string;
  sql: string;
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
    return {
      version,
      name: file,
      sql: readFileSync(join(MIGRATIONS_DIR, file), 'utf8'),
    };
  });
}

export function migrate(db: Db): { applied: number[] } {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all() as Array<{ version: number }>;
  const applied = new Set(appliedRows.map((r) => r.version));

  const appliedNow: number[] = [];
  const insert = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');

  for (const migration of loadMigrations()) {
    if (applied.has(migration.version)) continue;
    withTransaction(db, () => {
      db.exec(migration.sql);
      insert.run(migration.version, new Date().toISOString());
    });
    appliedNow.push(migration.version);
  }

  return { applied: appliedNow };
}
