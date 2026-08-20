import { backup, DatabaseSync } from 'node:sqlite';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { config } from '../config.ts';

function positiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 3650) {
    throw new Error('CRA_BACKUP_RETENTION_DAYS 必须是 1–3650 的整数');
  }
  return parsed;
}

function cleanExpiredBackups(backupDir: string, retentionDays: number): number {
  const root = resolve(backupDir);
  const cutoff = Date.now() - retentionDays * 86_400_000;
  let removed = 0;
  for (const name of readdirSync(root)) {
    if (!/^cra-\d{4}-.*\.db$/.test(name)) continue;
    const file = resolve(root, name);
    const relativePath = relative(root, file);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new Error('拒绝清理备份目录之外的文件');
    }
    if (statSync(file).mtimeMs < cutoff) {
      unlinkSync(file);
      removed += 1;
    }
  }
  return removed;
}

async function main(): Promise<void> {
  if (!existsSync(config.dbPath)) throw new Error(`数据库文件不存在：${config.dbPath}`);

  const backupDir = join(config.dataDir, 'backups');
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') chmodSync(backupDir, 0o700);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = join(backupDir, `cra-${stamp}.db`);
  if (existsSync(target)) throw new Error(`备份目标已存在，拒绝覆盖：${target}`);

  const source = new DatabaseSync(config.dbPath, { readOnly: true });
  try {
    const pages = await backup(source, target, { rate: 128 });
    const verification = new DatabaseSync(target);
    try {
      verification.exec('PRAGMA journal_mode = DELETE');
      const quick = verification.prepare('PRAGMA quick_check').all() as Array<Record<string, string>>;
      const messages = quick.flatMap((row) => Object.values(row));
      if (messages.length !== 1 || messages[0] !== 'ok') {
        throw new Error(`备份完整性检查失败：${messages.join('; ') || '未知错误'}`);
      }
      const foreignKeyErrors = verification.prepare('PRAGMA foreign_key_check').all();
      if (foreignKeyErrors.length > 0) throw new Error(`备份包含 ${foreignKeyErrors.length} 条外键异常`);
    } finally {
      verification.close();
    }
    if (process.platform !== 'win32') chmodSync(target, 0o600);
    const removed = cleanExpiredBackups(
      backupDir,
      positiveInt(process.env.CRA_BACKUP_RETENTION_DAYS, 30),
    );
    if (removed > 0) console.log('已清理过期备份：' + removed + ' 个');
    console.log(`备份完成并通过完整性检查：${target}（${pages} 页）`);
  } finally {
    source.close();
  }
}

main().catch((error: unknown) => {
  console.error('数据库备份失败：', error);
  process.exitCode = 1;
});
