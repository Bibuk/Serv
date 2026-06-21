import type { Task, Service } from '../types';

export type SLAState = 'ok' | 'risk' | 'breached' | 'done' | 'none';

export interface SLAInfo {
  state: SLAState;
  dueAt: Date | null;
  hoursLeft: number | null;
  resolutionHours: number | null;
}

const CLOSED = ['done', 'archive', 'reject'];
const RISK_FRACTION = 0.25;
const DEFAULT_RESOLUTION_HOURS = 24;

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
