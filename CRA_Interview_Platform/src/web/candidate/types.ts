import type { CandidateAuth } from './auth';

export interface CandidateLoginResponse {
  expiresIn: number;
  csrfToken: string;
  user: CandidateAuth;
}

export interface MyApplicationResponse {
  editable: boolean;
  applyPhase: 'not_started' | 'open' | 'ended';
  application: {
    id: number;
    name: string;
    studentNumber: string;
    gender: 'male' | 'female' | 'other' | null;
    college: string | null;
    phone: string;
    email: string;
    answers: Record<string, string>;
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
    slot: {
      id: number;
      startsAt: string;
      endsAt: string;
    } | null;
  };
}

export function formatCn(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso)).replaceAll('/', '-');
}

export function formatTimeRange(startsAt: string, endsAt: string): string {
  const start = formatCn(startsAt);
  const end = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(endsAt));
  return `${start} — ${end}`;
}
