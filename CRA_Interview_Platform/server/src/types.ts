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
