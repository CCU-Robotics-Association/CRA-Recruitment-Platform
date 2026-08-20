export type UserRole = 'super_admin' | 'admin' | 'reviewer';

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'waitlisted';

export const COLLEGE_VALUES = ['计算机科学技术学院', '电子信息工程学院', '数学与统计学院'] as const;
export type College = (typeof COLLEGE_VALUES)[number];

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
  gender: 'male' | 'female' | 'other' | null;
  college: string | null;
  className: string | null;
  email: string;
  phone: string;
  answers: string; 
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
