import type { Task, Service } from '../types';

// SLA tracking for the manager. A task inherits the resolution SLA (hours) of
// its service; the due time is computed from the task's creation date plus that
// allowance. Service metadata now comes from the backend (not localStorage),
// so callers pass a lookup built from the fetched services.
export type SLAState = 'ok' | 'risk' | 'breached' | 'done' | 'none';

export interface SLAInfo {
  state: SLAState;
  dueAt: Date | null;
  hoursLeft: number | null;     // negative when breached
  resolutionHours: number | null;
}

const CLOSED = ['done', 'archive', 'reject'];
// A task is "at risk" once less than this share of its SLA window remains.
const RISK_FRACTION = 0.25;
// Fallback resolution SLA (hours) when a service has no value — mirrors the
// default on the Services screen so SLA is meaningful out of the box.
const DEFAULT_RESOLUTION_HOURS = 24;

// Tasks reference their service by name or id depending on data source, so the
// lookup is keyed by both.
export function makeServiceLookup(services: Service[]): Map<string, Service> {
  const m = new Map<string, Service>();
  for (const s of services) {
    m.set(s.id, s);
    if (s.name) m.set(s.name, s);
  }
  return m;
}

export function taskSLA(
  task: Task,
  lookup?: Map<string, Service>,
  now: Date = new Date(),
): SLAInfo {
  const svc = lookup?.get(task.service);
  const resolutionHours = svc?.sla?.resolution ?? DEFAULT_RESOLUTION_HOURS;
  const created = new Date(task.created);
  if (isNaN(created.getTime())) {
    return { state: 'none', dueAt: null, hoursLeft: null, resolutionHours };
  }
  const dueAt = new Date(created.getTime() + resolutionHours * 3_600_000);
  if (CLOSED.includes(task.status)) {
    return { state: 'done', dueAt, hoursLeft: null, resolutionHours };
  }
  const hoursLeft = (dueAt.getTime() - now.getTime()) / 3_600_000;
  let state: SLAState = 'ok';
  if (hoursLeft < 0) state = 'breached';
  else if (hoursLeft < resolutionHours * RISK_FRACTION) state = 'risk';
  return { state, dueAt, hoursLeft, resolutionHours };
}

// Human-readable remaining/overdue time, e.g. "4 ч", "2 д", "просрочено 3 ч".
export function formatSLALeft(info: SLAInfo): string {
  if (info.hoursLeft == null) return '—';
  const abs = Math.abs(info.hoursLeft);
  const txt = abs >= 24 ? `${Math.round(abs / 24)} д` : `${Math.max(1, Math.round(abs))} ч`;
  return info.hoursLeft < 0 ? `просрочено ${txt}` : txt;
}

export const SLA_COLORS: Record<SLAState, string> = {
  ok: '#059669',
  risk: '#D97706',
  breached: '#DC2626',
  done: '#6B7280',
  none: '#9CA3AF',
};

export const SLA_LABELS: Record<SLAState, string> = {
  ok: 'В норме',
  risk: 'Под угрозой',
  breached: 'Нарушен',
  done: 'Закрыта',
  none: 'Без SLA',
};
