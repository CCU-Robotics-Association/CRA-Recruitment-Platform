/**
 * 领域类型（与数据库表一一对应，输出时统一 camelCase）。
 */

export type UserRole = 'super_admin' | 'admin' | 'reviewer';

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'waitlisted';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'waitlisted',
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: '已报名',
  under_review: '审核中',
  approved: '已通过',
  rejected: '已淘汰',
  waitlisted: '候补',
};

export interface UserRow {
  id: number;
  username: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  isActive: number;
  tokenVersion: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoundRow {
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
}

export interface SlotRow {
  id: number;
  roundId: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  isEnabled: number;
  createdAt: string;
}

export interface ApplicationRow {
  id: number;
  roundId: number;
  slotId: number | null;
  name: string;
  studentNumber: string;
  email: string;
  phone: string;
  answers: string; // JSON
  queryCode: string;
  status: ApplicationStatus;
  reviewNote: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 面试环节状态（独立于报名审核状态，由管理端统一流转）：
 * - pending    待面试（审核通过后自动建立）
 * - completed  已面试，待出结果
 * - no_show    未到场
 * - passed     面试通过
 * - failed     面试不通过
 * - waitlisted 面试候补
 */
export type InterviewStatus =
  | 'pending'
  | 'completed'
  | 'no_show'
  | 'passed'
  | 'failed'
  | 'waitlisted';

export const INTERVIEW_STATUSES: InterviewStatus[] = [
  'pending',
  'completed',
  'no_show',
  'passed',
  'failed',
  'waitlisted',
];

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  pending: '待面试',
  completed: '已面试',
  no_show: '未到场',
  passed: '通过',
  failed: '不通过',
  waitlisted: '候补',
};

export interface InterviewRow {
  id: number;
  applicationId: number;
  status: InterviewStatus;
  score: number | null;
  comment: string | null;
  resultPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicMetaResponse {
  round: {
    id: number;
    title: string;
    description: string;
    applyStartAt: string;
    applyEndAt: string;
    isOpen: boolean;
    applyPhase: 'not_started' | 'open' | 'ended';
  };
  slots: Array<{
    id: number;
    startsAt: string;
    endsAt: string;
    capacity: number;
    booked: number;
    remaining: number;
    available: boolean;
  }>;
}
