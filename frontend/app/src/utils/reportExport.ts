import type { Task, Ticket } from '../types';
import type { DashboardData } from '../api';
import { STATUSES } from '../data/mock';
import { ruDate } from './helpers';

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Критичный',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  new: 'Новая', inprog: 'В обработке', accepted: 'В работе', closed: 'Закрыта', rejected: 'Отклонена',
};

export const statusLabel = (s: string): string =>
  STATUSES[s as keyof typeof STATUSES]?.label ?? s;
export const priorityLabel = (p: string): string => PRIORITY_LABELS[p] ?? p;

const today = () => new Date().toISOString().slice(0, 10);
const nowLabel = () =>
  new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Robust CSV download: UTF-8 BOM (so Excel reads Cyrillic), ';' delimiter
 * (the default Excel expects in RU/EU locales), CRLF line breaks, and proper
 * quoting/escaping so commas, quotes and newlines in values never break columns.
 */
export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  const esc = (v: string | number | null | undefined): string => {
    const s = String(v ?? '');
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers, ...rows].map(r => r.map(esc).join(';'));
  const csv = '﻿' + lines.join('\r\n');
  triggerDownload(filename, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
}

export function exportTasksCSV(tasks: Task[]): void {
  downloadCSV(
    `Отчёт_задачи_${today()}.csv`,
    ['ID', 'Название', 'Сервис', 'Команда', 'Приоритет', 'Статус', 'Дедлайн', 'Создана'],
    tasks.map(t => [
      t.id, t.title, t.service || '—', t.team || '—',
      priorityLabel(t.priority), statusLabel(t.status),
      t.deadline ? ruDate(t.deadline) : '—', ruDate(t.created),
    ]),
  );
}

export function exportTicketsCSV(tickets: Ticket[]): void {
  downloadCSV(
    `Отчёт_заявки_${today()}.csv`,
    ['ID', 'Заявка', 'Приложение', 'Приоритет', 'Статус', 'Создана', 'Обновлена', 'Задача'],
    tickets.map(t => [
      t.id, t.title, t.app || '—',
      priorityLabel(t.priority), statusLabel(t.status),
      ruDate(t.created), ruDate(t.updated), t.taskId ?? '—',
    ]),
  );
}

/* ---------- Printable PDF report ---------- */

interface KpiItem { label: string; value: string | number; accent?: 'ok' | 'warn' | 'bad' }
interface ReportTable { heading: string; headers: string[]; rows: (string | number)[][]; empty?: string }

interface PrintableReport {
  title: string;
  subtitle: string;
  kpis?: KpiItem[];
  tables?: ReportTable[];
}

const escHtml = (s: string | number): string =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function renderReportHTML(r: PrintableReport): string {
  const kpiCards = (r.kpis ?? []).map(k => `
    <div class="kpi kpi--${k.accent ?? 'neutral'}">
      <div class="kpi__label">${escHtml(k.label)}</div>
      <div class="kpi__value">${escHtml(k.value)}</div>
    </div>`).join('');

  const tables = (r.tables ?? []).map(t => `
    <section class="block">
      <h2>${escHtml(t.heading)}</h2>
      ${t.rows.length === 0
        ? `<p class="muted">${escHtml(t.empty ?? 'Нет данных')}</p>`
        : `<table>
            <thead><tr>${t.headers.map(h => `<th>${escHtml(h)}</th>`).join('')}</tr></thead>
            <tbody>${t.rows.map(row => `<tr>${row.map(c => `<td>${escHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>`}
    </section>`).join('');

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>${escHtml(r.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1F2937; margin: 0; padding: 32px 36px; background: #fff; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563EB; padding-bottom: 16px; margin-bottom: 24px; }
  .head__brand { font-size: 13px; font-weight: 700; color: #2563EB; letter-spacing: .04em; text-transform: uppercase; }
  h1 { font-size: 24px; font-weight: 700; margin: 6px 0 2px; }
  .head__sub { font-size: 13px; color: #6B7280; }
  .head__meta { text-align: right; font-size: 12px; color: #9CA3AF; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { border: 1px solid #E5E7EB; border-radius: 10px; padding: 14px 16px; }
  .kpi__label { font-size: 12px; color: #6B7280; margin-bottom: 6px; }
  .kpi__value { font-size: 26px; font-weight: 700; letter-spacing: -.02em; }
  .kpi--ok .kpi__value { color: #059669; }
  .kpi--warn .kpi__value { color: #D97706; }
  .kpi--bad .kpi__value { color: #DC2626; }
  .block { margin-bottom: 24px; page-break-inside: avoid; }
  h2 { font-size: 15px; font-weight: 600; margin: 0 0 10px; color: #111827; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6B7280; font-weight: 600; padding: 8px 10px; border-bottom: 2px solid #E5E7EB; }
  td { padding: 8px 10px; border-bottom: 1px solid #F3F4F6; }
  tbody tr:nth-child(even) { background: #F9FAFB; }
  .muted { color: #9CA3AF; font-size: 13px; }
  .foot { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E5E7EB; font-size: 11px; color: #9CA3AF; text-align: center; }
  .toolbar { position: sticky; top: 0; z-index: 10; background: #fff; border-bottom: 1px solid #E5E7EB; padding: 10px 36px; display: flex; gap: 8px; justify-content: flex-end; }
  .btn-dl { display: inline-flex; align-items: center; gap: 6px; background: #2563EB; color: #fff; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .btn-dl:hover { background: #1D4ED8; }
  .btn-cl { display: inline-flex; align-items: center; gap: 6px; background: #F3F4F6; color: #374151; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .btn-cl:hover { background: #E5E7EB; }
  @media print { .toolbar { display: none; } body { padding: 0; } @page { margin: 16mm; } }
</style></head>
<body>
  <div class="toolbar">
    <button class="btn-cl" onclick="window.close()">✕ Закрыть</button>
    <button class="btn-dl" onclick="window.print()">⬇ Сохранить как PDF</button>
  </div>
  <div class="head">
    <div>
      <div class="head__brand">2LTP · Отчёт</div>
      <h1>${escHtml(r.title)}</h1>
      <div class="head__sub">${escHtml(r.subtitle)}</div>
    </div>
    <div class="head__meta">Сформирован<br>${escHtml(nowLabel())}</div>
  </div>
  ${kpiCards ? `<div class="kpis">${kpiCards}</div>` : ''}
  ${tables}
  <div class="foot">Документ сформирован автоматически системой 2LTP · ${escHtml(nowLabel())}</div>
</body></html>`;
}

export function openPrintableReport(report: PrintableReport): void {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) {
    alert('Разрешите всплывающие окна, чтобы сформировать отчёт.');
    return;
  }
  w.document.open();
  w.document.write(renderReportHTML(report));
  w.document.close();
}

export function exportAnalyticsReport(d: DashboardData, periodLabel: string): void {
  const scopeLabel = d.scope === 'team'
    ? `Команда «${d.teamName ?? '—'}»`
    : 'Все команды';

  const kpis: KpiItem[] = [
    { label: 'Всего задач', value: d.totalTasks },
    { label: 'Выполнено', value: d.done, accent: 'ok' },
    { label: 'Выполнение', value: `${d.completionRate}%` },
    { label: 'Срок соблюдён', value: `${d.onTimePercent}%`, accent: d.onTimePercent < 70 ? 'warn' : 'ok' },
    { label: 'Просрочено', value: d.overdueCount, accent: d.overdueCount > 0 ? 'bad' : 'ok' },
    { label: 'Среднее время, дн.', value: d.avgCompletionDays },
  ];

  const tables: ReportTable[] = [
    {
      heading: 'Задачи по статусам',
      headers: ['Статус', 'Количество'],
      rows: d.byStatus.map(s => [statusLabel(s.status), s.count]),
      empty: 'Нет задач за период',
    },
  ];

  if (d.scope === 'team') {
    tables.push({
      heading: 'Загрузка сотрудников',
      headers: ['Сотрудник', 'Активные', 'Выполнено'],
      rows: d.workerLoad.map(w => [w.name, w.active, w.done]),
      empty: 'Нет подзадач за период',
    });
  } else {
    tables.push({
      heading: 'Нагрузка команд',
      headers: ['Команда', 'Активных задач', 'Участников'],
      rows: d.teamLoad.map(t => [t.teamName, t.activeTasks, t.memberCount]),
      empty: 'Нет данных',
    });
    tables.push({
      heading: 'Заявки клиентов по статусам',
      headers: ['Статус', 'Количество'],
      rows: d.ticketsByStatus.map(s => [TICKET_STATUS_LABELS[s.status] ?? s.status, s.count]),
      empty: 'Нет заявок за период',
    });
    tables.push({
      heading: 'Заявки по приоритету',
      headers: ['Приоритет', 'Количество'],
      rows: d.ticketsByPriority.map(p => [priorityLabel(p.priority), p.count]),
      empty: 'Нет заявок за период',
    });
  }

  tables.push({
    heading: 'Динамика по неделям',
    headers: ['Неделя', 'Создано', 'Закрыто'],
    rows: d.weekly.map(w => [w.label, w.created, w.closed]),
    empty: 'Нет данных за период',
  });

  tables.push({
    heading: `Просроченные задачи (${d.overdueCount})`,
    headers: ['Название', 'Команда', 'Дедлайн', 'Приоритет'],
    rows: d.overdue.map(o => [o.title, o.teamName ?? '—', ruDate(o.deadline.slice(0, 10)), priorityLabel(o.priority)]),
    empty: 'Просроченных задач нет',
  });

  openPrintableReport({
    title: d.scope === 'team' ? 'Аналитический отчёт команды' : 'Аналитический отчёт',
    subtitle: `${scopeLabel} · период: ${periodLabel}`,
    kpis,
    tables,
  });
}
