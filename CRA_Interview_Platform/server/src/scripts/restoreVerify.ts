import { DatabaseSync } from 'node:sqlite';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { config } from '../config.ts';
import { assertDatabaseIntegrity } from '../lib/health.ts';

function latestBackup(): string {
  const backupDir = join(config.dataDir, 'backups');
  const names = readdirSync(backupDir)
    .filter((name) => /^cra-\d{4}-.*\.db$/.test(name))
    .sort()
    .reverse();
  if (!names[0]) throw new Error('没有可供恢复验证的备份');
  return join(backupDir, names[0]);
}

function main(): void {
  const source = resolve(process.argv[2] ?? latestBackup());
  if (!existsSync(source)) throw new Error('备份文件不存在：' + source);
  const tempDir = mkdtempSync(join(tmpdir(), 'cra-restore-'));
  const restored = join(tempDir, basename(source));
  try {
    copyFileSync(source, restored);
    if (process.platform !== 'win32') chmodSync(restored, 0o600);
    const db = new DatabaseSync(restored);
    try {
      db.exec('PRAGMA foreign_keys = ON');
      assertDatabaseIntegrity(db);
      const summary = {
        users: Number((db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count),
        rounds: Number(
          (db.prepare('SELECT COUNT(*) AS count FROM recruitment_rounds').get() as { count: number }).count,
        ),
        slots: Number(
          (db.prepare('SELECT COUNT(*) AS count FROM interview_slots').get() as { count: number }).count,
        ),
        applications: Number(
          (db.prepare('SELECT COUNT(*) AS count FROM applications').get() as { count: number }).count,
        ),
      };
      console.log(JSON.stringify({ status: 'restore-verified', source, summary }, null, 2));
    } finally {
      db.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error('备份恢复验证失败：', error);
  process.exitCode = 1;
}
