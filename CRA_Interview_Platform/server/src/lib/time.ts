/**
 * 时间工具。系统统一使用 Asia/Shanghai 时区存储（数据库存 ISO-8601 带时区的 UTC 时刻，
 * 展示/解析按北京时间）。
 */

export const TIMEZONE = 'Asia/Shanghai';

/** 当前时间（UTC ISO 字符串，如 2026-09-10T01:00:00.000Z） */
export function nowIso(): string {
  return new Date().toISOString();
}

/** 生成时间段的唯一 id（进程内防重复，例如批量生成时段） */
export function slotKey(startsAt: string, endsAt: string): string {
  return `${startsAt}|${endsAt}`;
}

/** 把本地（Asia/Shanghai）日期时间字符串解析为 UTC ISO 字符串 */
export function parseLocalDateTime(localIso: string): string {
  const parsed = new Date(localIso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`无法解析的本地时间: ${localIso}`);
  }
  return parsed.toISOString();
}

/** 将 Date 格式化为北京时间下的 yyyy-MM-dd HH:mm */
export function formatCn(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/\//g, '-');
}

/** 将 UTC ISO 字符串格式化为北京时间 yyyy-MM-dd HH:mm */
export function formatCnFromIso(iso: string): string {
  return formatCn(new Date(iso));
}

/** 北京时间下的当天 00:00 对应的 UTC 时刻 */
export function startOfLocalDay(date: Date): Date {
  const cn = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const [y, m, d] = cn.split('-').map(Number);
  // Date.UTC(y, m-1, d) 是 "y-m-d 00:00 UTC"，即北京时间 y-m-d 08:00；
  // 北京时间 y-m-d 00:00 需再减 8 小时（Asia/Shanghai 固定 UTC+8，无夏令时）。
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - 8 * 60 * 60 * 1000);
}

/** 北京时间下某天的 23:59:59.999（UTC 时刻） */
export function endOfLocalDay(date: Date): Date {
  const start = startOfLocalDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}
