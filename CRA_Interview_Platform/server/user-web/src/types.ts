/** 用户端 API 数据类型 */

export type ApplicationStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'waitlisted';

export type InterviewStatus = 'pending' | 'completed' | 'no_show' | 'passed' | 'failed' | 'waitlisted';

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  pending: '待面试',
  completed: '已面试',
  no_show: '未到场',
  passed: '通过',
  failed: '不通过',
  waitlisted: '候补',
};

export const INTERVIEW_STATUS_TYPES: Record<
  InterviewStatus,
  'info' | 'warning' | 'success' | 'danger' | 'primary'
> = {
  pending: 'info',
  completed: 'warning',
  no_show: 'danger',
  passed: 'success',
  failed: 'danger',
  waitlisted: 'primary',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: '已报名',
  under_review: '审核中',
  approved: '已通过',
  rejected: '已淘汰',
  waitlisted: '候补',
};

export interface Slot {
  id: number;
  startsAt: string;
  endsAt: string;
}

export interface MyInterviewResponse {
  application: {
    id: number;
    name: string;
    studentNumber: string;
    phone: string;
    email: string;
    status: ApplicationStatus;
    statusLabel: string;
    createdAt: string;
    updatedAt: string;
    round: {
      id: number;
      title: string;
      description: string;
      applyStartAt: string;
      applyEndAt: string;
      interviewStartAt: string | null;
      interviewEndAt: string | null;
    };
    slot: Slot | null;
  };
  interview: {
    status: InterviewStatus;
    statusLabel: string;
    score: number | null;
    comment: string | null;
    resultPublished: boolean;
    resultPublishedAt: string | null;
    updatedAt: string;
  } | null;
  resultVisible: boolean;
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
