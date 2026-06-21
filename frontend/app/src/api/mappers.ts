// Adapter layer between the backend API shape and the frontend domain types.
//
// The backend returns normalised, snake_case payloads wrapped in pagination
// envelopes ({ items, total, page, size, pages }) and uses canonical enum
// values (in_progress, rejected, archived, processing, …). The frontend was
// built against flat camelCase mock data with abbreviated enum values
// (inprog, reject, archive, …). These mappers translate between the two so
// the rest of the app keeps working against the frontend types unchanged.

import type {
  Task, Ticket, Subtask, User, AuditEntry, Comment, TaskStatus, SubtaskStatus, TicketStatus, Priority, Role,
} from '../types';
import type { NotificationDto } from './notifications';

// ── Pagination envelope ─────────────────────────────────────────────────────

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Accepts either a paginated envelope or a bare array and always returns items.
export function unwrap<T>(data: Paginated<T> | T[]): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as Paginated<T>).items)) return (data as Paginated<T>).items;
  return [];
}

// ── Status translation ──────────────────────────────────────────────────────

const TASK_STATUS_TO_FRONTEND: Record<string, TaskStatus> = {
  draft: 'draft',
  assigned: 'assigned',
  in_progress: 'inprog',
  review: 'review',
  done: 'done',
  rejected: 'reject',
  archived: 'archive',
};

const TASK_STATUS_TO_BACKEND: Record<TaskStatus, string> = {
  draft: 'draft',
  assigned: 'assigned',
  inprog: 'in_progress',
  review: 'review',
  done: 'done',
  reject: 'rejected',
  archive: 'archived',
};

export const toFrontendTaskStatus = (s: string): TaskStatus =>
  TASK_STATUS_TO_FRONTEND[s] ?? (s as TaskStatus);
export const toBackendTaskStatus = (s: TaskStatus): string =>
  TASK_STATUS_TO_BACKEND[s] ?? s;

const TICKET_STATUS_TO_FRONTEND: Record<string, TicketStatus> = {
  new: 'new',
  processing: 'inprog',
  accepted: 'accepted',
  rejected: 'rejected',
  closed: 'closed',
};

const TICKET_STATUS_TO_BACKEND: Record<TicketStatus, string> = {
  new: 'new',
  inprog: 'processing',
  accepted: 'accepted',
  rejected: 'rejected',
  closed: 'closed',
};

export const toFrontendTicketStatus = (s: string): TicketStatus =>
  TICKET_STATUS_TO_FRONTEND[s] ?? (s as TicketStatus);
export const toBackendTicketStatus = (s: TicketStatus): string =>
  TICKET_STATUS_TO_BACKEND[s] ?? s;

// Subtasks use a distinct backend enum (todo/in_progress/blocked/done). The
// frontend mirrors it with its own SubtaskStatus vocabulary so a blocked
// subtask is never conflated with a task in review.
const SUBTASK_STATUS_TO_FRONTEND: Record<string, SubtaskStatus> = {
  todo: 'todo',
  in_progress: 'inprog',
  blocked: 'blocked',
  done: 'done',
};

const SUBTASK_STATUS_TO_BACKEND: Record<string, string> = {
  todo: 'todo',
  inprog: 'in_progress',
  blocked: 'blocked',
  done: 'done',
};

export const toFrontendSubtaskStatus = (s: string): SubtaskStatus =>
  SUBTASK_STATUS_TO_FRONTEND[s] ?? (s as SubtaskStatus);
export const toBackendSubtaskStatus = (s: string): string =>
  SUBTASK_STATUS_TO_BACKEND[s] ?? s;

// ── Helpers ─────────────────────────────────────────────────────────────────

// Backend deadlines/created dates are ISO datetimes; several frontend screens
// treat deadlines as date-only strings (e.g. `new Date(deadline + 'T23:59:59')`).
const dateOnly = (iso: string | null | undefined): string =>
  iso ? iso.slice(0, 10) : '';

const AVATAR_COLORS = [
  '#2563EB', '#7C3AED', '#059669', '#D97706',
  '#DC2626', '#EC4899', '#0EA5E9', '#10B981',
  '#6366F1', '#F59E0B', '#8B5CF6', '#9CA3AF',
];

const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('').slice(0, 2) || '?';

const colorFor = (id: string): string => {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};

// ── Raw backend shapes (only the fields we consume) ─────────────────────────

interface RawUserOut {
  id: string;
  email: string;
  full_name: string;
  role: string;
  team_id?: string | null;
  team_name?: string | null;
  is_active?: boolean;
  notify_email?: boolean;
}

interface RawServiceOut { id: string; name: string }
interface RawTeamBrief { id: string; name: string }
interface RawApplicationOut { id: string; name: string }

interface RawSubtaskOut {
  id: string;
  title: string;
  status: string;
  task_id?: string;
  assignee_id?: string | null;
  assignee?: RawUserOut | null;
  deadline?: string | null;
}

interface RawTaskOut {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  service_id: string;
  service?: RawServiceOut | null;
  team_id?: string | null;
  team?: RawTeamBrief | null;
  ticket_id?: string | null;
  created_by: string;
  creator?: RawUserOut | null;
  deadline?: string | null;
  reject_reason?: string | null;
  created_at: string;
  updated_at: string;
  subtasks?: RawSubtaskOut[];
}

interface RawTicketOut {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  client_id: string;
  client?: RawUserOut | null;
  application_id: string;
  application?: RawApplicationOut | null;
  task_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface RawNotificationOut {
  id: string;
  user_id: string;
  title: string;
  body: string;
  entity_type: string;
  entity_id?: string | null;
  is_read: boolean;
  created_at: string;
}

interface RawAuditOut {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
  user_full_name?: string | null;
  user_email?: string | null;
}

// ── Mappers: backend → frontend ─────────────────────────────────────────────

export function mapUser(u: RawUserOut): User {
  return {
    id: u.id,
    name: u.full_name,
    role: u.role as Role,
    team: u.team_name ?? '',
    avatar: initials(u.full_name),
    color: colorFor(u.id),
    email: u.email,
    active: u.is_active ?? true,
    teamId: u.team_id ?? null,
    notifyEmail: u.notify_email ?? true,
  };
}

// ── Teams ───────────────────────────────────────────────────────────────────

interface RawTeamOut {
  id: string;
  name: string;
  teamlead_id?: string | null;
  teamlead?: RawUserOut | null;
  members?: RawUserOut[];
  created_at: string;
}

export interface TeamDetail {
  id: string;
  name: string;
  teamleadId: string | null;
  teamleadName: string;
  members: User[];
  created: string;
}

export function mapTeam(t: RawTeamOut): TeamDetail {
  return {
    id: t.id,
    name: t.name,
    teamleadId: t.teamlead_id ?? null,
    teamleadName: t.teamlead?.full_name ?? '',
    members: (t.members ?? []).map(mapUser),
    created: t.created_at,
  };
}

export function mapSubtask(s: RawSubtaskOut): Subtask {
  return {
    id: s.id,
    title: s.title,
    worker: s.assignee_id ?? '',
    status: toFrontendSubtaskStatus(s.status),
    deadline: dateOnly(s.deadline),
    taskId: s.task_id,
    workerName: s.assignee?.full_name,
  };
}

interface RawCommentOut {
  id: string;
  body: string;
  author_id: string;
  author?: RawUserOut | null;
  is_visible_to_client: boolean;
  created_at: string;
}

export function mapComment(c: RawCommentOut): Comment {
  return {
    id: c.id,
    author: c.author?.full_name ?? c.author_id,
    date: c.created_at,
    text: c.body,
    visibleToClient: c.is_visible_to_client,
  };
}

export function mapTask(t: RawTaskOut): Task {
  return {
    id: t.id,
    title: t.title,
    desc: t.description,
    service: t.service?.name ?? t.service_id,
    team: t.team?.name ?? '',
    priority: t.priority as Priority,
    status: toFrontendTaskStatus(t.status),
    deadline: dateOnly(t.deadline),
    created: dateOnly(t.created_at),
    createdBy: t.creator?.full_name ?? t.created_by,
    ticket: t.ticket_id ?? null,
    app: '',
    subtasks: (t.subtasks ?? []).map(mapSubtask),
    comments: [],
    activity: [],
    rejectReason: t.reject_reason ?? undefined,
  };
}

export function mapTicket(t: RawTicketOut): Ticket {
  return {
    id: t.id,
    title: t.title,
    desc: t.description,
    app: t.application?.name ?? t.application_id,
    priority: t.priority as Priority,
    status: toFrontendTicketStatus(t.status),
    created: t.created_at,
    updated: t.updated_at,
    client: t.client?.full_name ?? t.client_id,
    taskId: t.task_id ?? null,
    comments: [],
  };
}

export function mapNotification(n: RawNotificationOut): NotificationDto {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    read: n.is_read,
    taskId: n.entity_id ?? undefined,
    kind: n.entity_type,
    ts: n.created_at,
  };
}

const auditKind = (action: string): AuditEntry['kind'] => {
  if (action.includes('login')) return 'login';
  if (action.includes('created')) return 'create';
  if (action.includes('deleted')) return 'delete';
  return 'update';
};

export function mapAuditEntry(a: RawAuditOut): AuditEntry {
  return {
    id: a.id,
    action: a.action,
    user: a.user_full_name ?? a.user_id,
    target: a.entity_id ?? a.entity_type,
    kind: auditKind(a.action),
    timestamp: a.created_at,
  };
}
