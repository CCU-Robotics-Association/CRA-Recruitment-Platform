/** 管理端 API 数据类型 */

export interface Slot {
  id: number;
  roundId: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  isEnabled: number;
  createdAt: string;
  booked: number;
  remaining: number;
}

export interface Application {
  id: number;
  roundId: number;
  slotId: number | null;
  name: string;
  studentNumber: string;
  gender: 'male' | 'female' | 'other' | null;
  college: string | null;
  className: string | null;
  email: string;
  phone: string;
  answers: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  slot?: { id: number; startsAt: string; endsAt: string } | null;
}

export interface ApplicationListResponse {
  items: Application[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StatsOverview {
  total: number;
  todayNew: number;
  todayNewAt: string;
  slotOccupancy: Array<{
    slotId: number;
    startsAt: string;
    endsAt: string;
    capacity: number;
    booked: number;
    remaining: number;
  }>;
  recent: Array<{ id: number; name: string; studentNumber: string; createdAt: string }>;
}

export interface Round {
  id: number;
  title: string;
  description: string;
  applyStartAt: string;
  applyEndAt: string;
  interviewStartAt: string | null;
  interviewEndAt: string | null;
  isOpen: number;
  createdAt: string;
  updatedAt: string;
  applicationCount?: number;
  slotCount?: number;
}

export interface AdminUserRow {
  id: number;
  username: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'reviewer';
  isActive: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 北京时间格式化工具 */
export function formatCn(iso: string | null | undefined, withSeconds = false): string {
  if (!iso) return '-';
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(date);
  return parts.replace(/\//g, '-');
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date(iso))
    .replace(/\//g, '-');
}

export function formatTimeRange(startsAt: string, endsAt: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(new Date(iso))
      .replace(/\//g, '-');
  return `${fmt(startsAt)} – ${fmt(endsAt)}`;
}
