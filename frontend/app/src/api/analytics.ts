import { apiClient } from './client';
import { toFrontendTaskStatus, toFrontendTicketStatus } from './mappers';
import { TASKS, TICKETS } from '../data/mock';
import type { Role } from '../types';

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export type AnalyticsPeriod = '7d' | '30d' | '90d';

export interface StatusCount { status: string; count: number }
export interface PriorityCount { priority: string; count: number }
export interface WeeklyPoint { label: string; created: number; closed: number }
export interface WorkerLoad { name: string; active: number; done: number }
export interface TeamLoad { teamName: string; activeTasks: number; memberCount: number }
export interface OverdueRow { id: string; title: string; teamName: string | null; deadline: string; priority: string }

export interface DashboardData {
  scope: 'team' | 'global';
  teamName: string | null;
  periodDays: number;
  totalTasks: number;
  done: number;
  completionRate: number;
  avgCompletionDays: number;
  onTimePercent: number;
  overdueCount: number;
  activeTickets: number;
  byStatus: StatusCount[];
  weekly: WeeklyPoint[];
  teamLoad: TeamLoad[];
  workerLoad: WorkerLoad[];
  ticketsTotal: number;
  ticketsByStatus: StatusCount[];
  ticketsByPriority: PriorityCount[];
  overdue: OverdueRow[];
}

interface RawDashboard {
  scope: 'team' | 'global';
  team_name: string | null;
  period_days: number;
  total_tasks: number;
  done: number;
  completion_rate: number;
  avg_completion_days: number;
  on_time_percent: number;
  overdue_count: number;
  active_tickets: number;
  by_status: StatusCount[];
  weekly: WeeklyPoint[];
  team_load: { team_name: string; active_tasks: number; member_count: number }[];
  worker_load: WorkerLoad[];
  tickets_total: number;
  tickets_by_status: StatusCount[];
  tickets_by_priority: PriorityCount[];
  overdue: { id: string; title: string; team_name: string | null; deadline: string; priority: string }[];
}

function mapDashboard(r: RawDashboard): DashboardData {
  return {
    scope: r.scope,
    teamName: r.team_name,
    periodDays: r.period_days,
    totalTasks: r.total_tasks,
    done: r.done,
    completionRate: r.completion_rate,
    avgCompletionDays: r.avg_completion_days,
    onTimePercent: r.on_time_percent,
    overdueCount: r.overdue_count,
    activeTickets: r.active_tickets,
    byStatus: r.by_status.map(s => ({ status: toFrontendTaskStatus(s.status), count: s.count })),
    weekly: r.weekly,
    teamLoad: r.team_load.map(t => ({ teamName: t.team_name, activeTasks: t.active_tasks, memberCount: t.member_count })),
    workerLoad: r.worker_load,
    ticketsTotal: r.tickets_total,
    ticketsByStatus: r.tickets_by_status.map(s => ({ status: toFrontendTicketStatus(s.status), count: s.count })),
    ticketsByPriority: r.tickets_by_priority,
    overdue: r.overdue.map(o => ({ id: o.id, title: o.title, teamName: o.team_name, deadline: o.deadline, priority: o.priority })),
  };
}

const RU_MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function mockDashboard(period: AnalyticsPeriod, role: Role, teamName: string): DashboardData {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const isTeamlead = role === 'teamlead';
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const scoped = (isTeamlead && teamName ? TASKS.filter(t => t.team === teamName) : TASKS);
  const inPeriod = scoped.filter(t => (t.created ?? '') >= cutoffStr);

  const total = inPeriod.length;
  const done = inPeriod.filter(t => t.status === 'done').length;

  const statusAcc: Record<string, number> = {};
  inPeriod.forEach(t => { statusAcc[t.status] = (statusAcc[t.status] ?? 0) + 1; });
  const byStatus = Object.entries(statusAcc).map(([status, count]) => ({ status, count }));

  const doneTasks = inPeriod.filter(t => t.status === 'done');
  const avgDays = doneTasks.length
    ? Math.round(doneTasks.reduce((a, t) => a + Math.max(1, (new Date(t.deadline).getTime() - new Date(t.created).getTime()) / 86_400_000), 0) / doneTasks.length * 10) / 10
    : 0;

  const overdueTasks = scoped.filter(t => t.deadline < today && !['done', 'archive'].includes(t.status));

  const weeklyMap: Record<string, { created: number; closed: number }> = {};
  inPeriod.forEach(t => {
    const d = new Date(t.created); d.setDate(d.getDate() - d.getDay());
    const k = d.toISOString().slice(0, 10);
    (weeklyMap[k] ??= { created: 0, closed: 0 }).created += 1;
    if (['done', 'archive'].includes(t.status)) weeklyMap[k].closed += 1;
  });
  const weekly = Object.entries(weeklyMap).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
    const d = new Date(k);
    return { label: `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`, created: v.created, closed: v.closed };
  });

  const workerLoad: WorkerLoad[] = [];
  if (isTeamlead) {
    const acc: Record<string, { active: number; done: number }> = {};
    inPeriod.forEach(t => (t.subtasks ?? []).forEach(s => {
      const name = s.workerName || s.worker || '—';
      (acc[name] ??= { active: 0, done: 0 });
      if (s.status === 'done') acc[name].done += 1; else acc[name].active += 1;
    }));
    Object.entries(acc).forEach(([name, v]) => workerLoad.push({ name, ...v }));
    workerLoad.sort((a, b) => b.active - a.active);
  }

  const teamLoad: TeamLoad[] = [];
  if (!isTeamlead) {
    const acc: Record<string, number> = {};
    scoped.filter(t => ['assigned', 'inprog', 'review'].includes(t.status)).forEach(t => {
      acc[t.team] = (acc[t.team] ?? 0) + 1;
    });
    Object.entries(acc).forEach(([teamName2, activeTasks]) => teamLoad.push({ teamName: teamName2, activeTasks, memberCount: 0 }));
  }

  const ticketsInPeriod = TICKETS.filter(t => (t.created ?? '').slice(0, 10) >= cutoffStr);
  const tStatusAcc: Record<string, number> = {};
  const tPrioAcc: Record<string, number> = {};
  ticketsInPeriod.forEach(t => {
    tStatusAcc[t.status] = (tStatusAcc[t.status] ?? 0) + 1;
    tPrioAcc[t.priority] = (tPrioAcc[t.priority] ?? 0) + 1;
  });

  return {
    scope: isTeamlead ? 'team' : 'global',
    teamName: isTeamlead ? (teamName || null) : null,
    periodDays: days,
    totalTasks: total,
    done,
    completionRate: total ? Math.round(done / total * 100) : 0,
    avgCompletionDays: avgDays,
    onTimePercent: doneTasks.length ? Math.round(doneTasks.filter(t => t.deadline >= t.created).length / doneTasks.length * 100) : 0,
    overdueCount: overdueTasks.length,
    activeTickets: TICKETS.filter(t => !['closed', 'rejected'].includes(t.status)).length,
    byStatus,
    weekly,
    teamLoad,
    workerLoad,
    ticketsTotal: ticketsInPeriod.length,
    ticketsByStatus: Object.entries(tStatusAcc).map(([status, count]) => ({ status, count })),
    ticketsByPriority: Object.entries(tPrioAcc).map(([priority, count]) => ({ priority, count })),
    overdue: overdueTasks.slice(0, 50).map(t => ({ id: t.id, title: t.title, teamName: t.team, deadline: t.deadline, priority: t.priority })),
  };
}

export async function getAnalyticsDashboard(period: AnalyticsPeriod, role: Role, teamName: string): Promise<DashboardData> {
  if (USE_MOCK) { await delay(120); return mockDashboard(period, role, teamName); }
  return mapDashboard(await apiClient.get<RawDashboard>(`/analytics/dashboard?period=${period}`));
}
