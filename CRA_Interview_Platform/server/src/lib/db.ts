/**
 * SQLite 连接（Node 24 内置 node:sqlite，零原生依赖）。
 * 提供事务包装、外键约束、WAL 模式、行映射工具。
 */
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.ts';

export type Db = DatabaseSync;

export function openDatabase(dbPath: string = config.dbPath): Db {
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;
  `);

  return db;
}

/**
 * 在单个写事务中执行 fn。SQLite 单写者，事务内所有语句串行；
 * 失败自动回滚并向上抛出。
 */
export function withTransaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** 行对象 -> 下划线转驼峰（API 输出统一 camelCase） */
export function toCamel<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
  }
  return out;
}

/** 数组行统一转换 */
export function toCamelAll<T extends Record<string, unknown>>(rows: T[]): Record<string, unknown>[] {
  return rows.map(toCamel);
}
