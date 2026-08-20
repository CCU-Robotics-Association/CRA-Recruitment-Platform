export const TIMEZONE = 'Asia/Shanghai';

export function nowIso(): string {
  return new Date().toISOString();
}

export function slotKey(startsAt: string, endsAt: string): string {
  return `${startsAt}|${endsAt}`;
}

export function parseLocalDateTime(localIso: string): string {
  const parsed = new Date(localIso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`无法解析的本地时间: ${localIso}`);
  }
  return parsed.toISOString();
}

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

export function formatCnFromIso(iso: string): string {
  return formatCn(new Date(iso));
}

export function startOfLocalDay(date: Date): Date {
  const cn = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const [y, m, d] = cn.split('-').map(Number);

  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - 8 * 60 * 60 * 1000);
}

export function endOfLocalDay(date: Date): Date {
  const start = startOfLocalDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}
