import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarOutlined, PrinterOutlined, CheckCircleOutlined, RiseOutlined,
  WarningOutlined, InboxOutlined, FieldTimeOutlined, ProfileOutlined,
} from '@ant-design/icons';
import { Stat, Donut, PriorityBadge } from '../../components';
import { useAppStore } from '../../store/appStore';
import { teamColor } from '../../utils/teamColor';
import { getAnalyticsDashboard, type AnalyticsPeriod } from '../../api';
import { exportAnalyticsReport } from '../../utils/reportExport';

const TASK_STATUS_META: Record<string, { color: string; label: string }> = {
  inprog:   { color: '#D97706', label: 'В работе' },
  done:     { color: '#059669', label: 'Выполнена' },
  assigned: { color: '#2563EB', label: 'Назначена' },
  review:   { color: '#7C3AED', label: 'На проверке' },
  reject:   { color: '#DC2626', label: 'Отклонена' },
  draft:    { color: '#6B7280', label: 'Черновик' },
  archive:  { color: '#9CA3AF', label: 'Архив' },
};

const TICKET_STATUS_META: Record<string, { color: string; label: string }> = {
  new:      { color: '#2563EB', label: 'Новые' },
  inprog:   { color: '#D97706', label: 'В обработке' },
  accepted: { color: '#0D9488', label: 'В работе' },
  closed:   { color: '#059669', label: 'Закрыты' },
  rejected: { color: '#DC2626', label: 'Отклонены' },
};

const PRIORITY_META: Record<string, { color: string; label: string }> = {
  critical: { color: '#DC2626', label: 'Критичный' },
  high:     { color: '#F97316', label: 'Высокий' },
  medium:   { color: '#2563EB', label: 'Средний' },
  low:      { color: '#9CA3AF', label: 'Низкий' },
};

const PERIOD_OPTIONS: { id: AnalyticsPeriod; label: string }[] = [
  { id: '7d',  label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: '90d', label: '90 дней' },
];

const Legend: React.FC<{ items: Array<{ count: number; color: string; label: string }> }> = ({ items }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {items.map((it, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--c-gray-700)' }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{it.label}</span>
        <span className="bold mono" style={{ color: 'var(--c-gray-900)' }}>{it.count}</span>
      </div>
    ))}
  </div>
);

const BarRow: React.FC<{ label: string; value: number; max: number; color: string; right?: string; labelWidth?: number }> = ({
  label, value, max, color, right, labelWidth = 90,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <span style={{ fontSize: 12, color: 'var(--c-gray-600)', width: labelWidth, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>{label}</span>
    <div style={{ flex: 1, height: 8, background: 'var(--c-gray-100)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${(value / max) * 100}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
    </div>
    <span className="mono" style={{ fontSize: 12, color: 'var(--c-gray-700)', minWidth: 36, textAlign: 'right', flexShrink: 0 }}>{right ?? value}</span>
  </div>
);

// Grouped created-vs-closed bar chart (one column per week).
const WeeklyChart: React.FC<{ data: Array<{ label: string; created: number; closed: number }> }> = ({ data }) => {
  if (data.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--c-gray-400)', padding: '28px 0', textAlign: 'center' }}>Нет данных за период</div>;
  }
  const max = Math.max(...data.flatMap(d => [d.created, d.closed]), 1);
  const H = 150;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: data.length > 8 ? 4 : 10, height: H, padding: '0 2px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: H - 18, width: '100%', justifyContent: 'center' }}>
              <div title={`Создано: ${d.created}`} style={{ width: '42%', maxWidth: 16, height: `${(d.created / max) * 100}%`, minHeight: d.created ? 3 : 0, background: '#2563EB', borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }} />
              <div title={`Закрыто: ${d.closed}`} style={{ width: '42%', maxWidth: 16, height: `${(d.closed / max) * 100}%`, minHeight: d.closed ? 3 : 0, background: '#059669', borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }} />
            </div>
            <span style={{ fontSize: 9, color: 'var(--c-gray-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{d.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--c-gray-600)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#2563EB' }} /> Создано
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--c-gray-600)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#059669' }} /> Закрыто
        </span>
      </div>
    </div>
  );
};

const Card: React.FC<{ title: string; sub?: string; children: React.ReactNode }> = ({ title, sub, children }) => (
  <div className="card">
    <div className="card__head">
      <span className="card__title">{title}</span>
      {sub && <span className="card__sub muted">{sub}</span>}
    </div>
    <div className="card__body" style={{ padding: 16 }}>{children}</div>
  </div>
);

export const AnalyticsScreen: React.FC = () => {
  const role = useAppStore(s => s.role);
  const currentUser = useAppStore(s => s.currentUser);
  const [period, setPeriod] = React.useState<AnalyticsPeriod>('30d');
  const [showPeriodMenu, setShowPeriodMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showPeriodMenu) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowPeriodMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showPeriodMenu]);

  const teamName = currentUser?.team ?? '';
  const dashQ = useQuery({
    queryKey: ['analytics-dashboard', period, role, teamName],
    queryFn: () => getAnalyticsDashboard(period, role, teamName),
  });

  const d = dashQ.data;
  const isTeamScope = d?.scope === 'team';
  const periodLabel = PERIOD_OPTIONS.find(p => p.id === period)?.label ?? '';

  const statusSlices = (d?.byStatus ?? [])
    .map(s => ({ count: s.count, color: TASK_STATUS_META[s.status]?.color ?? '#9CA3AF', label: TASK_STATUS_META[s.status]?.label ?? s.status }))
    .filter(s => s.count > 0);

  const ticketSlices = (d?.ticketsByStatus ?? [])
    .map(s => ({ count: s.count, color: TICKET_STATUS_META[s.status]?.color ?? '#9CA3AF', label: TICKET_STATUS_META[s.status]?.label ?? s.status }))
    .filter(s => s.count > 0);

  const maxWorker = Math.max(...(d?.workerLoad ?? []).map(w => w.active + w.done), 1);
  const maxTeam = Math.max(...(d?.teamLoad ?? []).map(t => t.activeTasks), 1);
  const maxPrio = Math.max(...(d?.ticketsByPriority ?? []).map(p => p.count), 1);

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{isTeamScope ? 'Аналитика команды' : 'Аналитика'}</h1>
          <p className="page-sub muted" style={{ margin: 0, marginTop: 2 }}>
            {isTeamScope
              ? (d?.teamName ? `Команда «${d.teamName}» · ${periodLabel}` : periodLabel)
              : `Сводка по всем командам · ${periodLabel}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button className="btn btn--outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowPeriodMenu(v => !v)}>
              <CalendarOutlined /> {periodLabel}
            </button>
            {showPeriodMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: 4,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 8, boxShadow: 'var(--sh-lg)', minWidth: 140, padding: '4px 0',
              }}>
                {PERIOD_OPTIONS.map(p => (
                  <button key={p.id} onClick={() => { setPeriod(p.id); setShowPeriodMenu(false); }} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px',
                    background: p.id === period ? 'var(--c-blue-50)' : 'none', border: 'none',
                    fontSize: 13, cursor: 'pointer',
                    color: p.id === period ? '#2563EB' : 'var(--c-gray-700)',
                    fontWeight: p.id === period ? 600 : 400,
                  }}>{p.label}</button>
                ))}
              </div>
            )}
          </div>
          <button
            className="btn btn--primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            disabled={!d}
            onClick={() => d && exportAnalyticsReport(d, periodLabel)}
          >
            <PrinterOutlined /> PDF-отчёт
          </button>
        </div>
      </div>

      {dashQ.isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--c-gray-400)', gap: 12 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span style={{ fontSize: 14 }}>Загрузка аналитики…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {dashQ.isError && (
        <div className="card"><div className="card__body" style={{ padding: 24, textAlign: 'center', color: 'var(--c-error)' }}>
          Не удалось загрузить аналитику
        </div></div>
      )}

      {d && (
        <>
          <div className="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Stat label="Всего задач" value={d.totalTasks} icon={<ProfileOutlined />} iconBg="#EFF6FF" iconColor="#2563EB" />
            <Stat label="Выполнено" value={d.done} icon={<CheckCircleOutlined />} iconBg="#ECFDF5" iconColor="#059669" />
            <Stat label="Выполнение" value={`${d.completionRate}%`} icon={<RiseOutlined />} iconBg="#F5F3FF" iconColor="#7C3AED" />
            <Stat label="Срок соблюдён" value={`${d.onTimePercent}%`} icon={<FieldTimeOutlined />} iconBg="#FFFBEB" iconColor="#D97706" alert={d.onTimePercent > 0 && d.onTimePercent < 70} />
            <Stat label="Просрочено" value={d.overdueCount} icon={<WarningOutlined />} iconBg="#FEF2F2" iconColor="#DC2626" alert={d.overdueCount > 0} />
            <Stat label="Активных заявок" value={d.activeTickets} icon={<InboxOutlined />} iconBg="#EFF6FF" iconColor="#2563EB" />
          </div>

          <Card title="Среднее время выполнения" sub="по закрытым задачам за период">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--c-gray-900)' }}>{d.avgCompletionDays}</span>
              <span style={{ fontSize: 14, color: 'var(--c-gray-500)' }}>дней в среднем от создания до завершения</span>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <Card title="Задачи по статусам">
              {statusSlices.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Нет задач за период</span>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <Donut slices={statusSlices.map(s => ({ v: s.count, color: s.color, label: s.label }))} value={d.totalTasks} label="задач" />
                  <div style={{ flex: 1, minWidth: 0 }}><Legend items={statusSlices} /></div>
                </div>
              )}
            </Card>

            <Card title="Динамика по неделям" sub="создано vs закрыто">
              <WeeklyChart data={d.weekly} />
            </Card>

            {isTeamScope ? (
              <Card title="Загрузка сотрудников" sub="активные · всего подзадач">
                {d.workerLoad.length === 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Нет подзадач за период</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {d.workerLoad.map(w => (
                      <div key={w.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: 'var(--c-gray-600)', width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.name}>{w.name}</span>
                        <div style={{ flex: 1, height: 8, background: 'var(--c-gray-100)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                          <div style={{ height: '100%', width: `${(w.active / maxWorker) * 100}%`, background: '#D97706', transition: 'width 0.4s' }} />
                          <div style={{ height: '100%', width: `${(w.done / maxWorker) * 100}%`, background: '#059669', transition: 'width 0.4s' }} />
                        </div>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--c-gray-700)', minWidth: 48, textAlign: 'right', flexShrink: 0 }}>{w.active}/{w.active + w.done}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <Card title="Нагрузка команд" sub="активных задач">
                {d.teamLoad.length === 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Нет данных</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {d.teamLoad.map(t => (
                      <BarRow key={t.teamName} label={t.teamName} value={t.activeTasks} max={maxTeam} color={teamColor(t.teamName)}
                        right={`${t.activeTasks}${t.memberCount ? ` · ${t.memberCount} чел.` : ''}`} labelWidth={120} />
                    ))}
                  </div>
                )}
              </Card>
            )}

            {!isTeamScope && (
              <Card title="Заявки по приоритету" sub={`${d.ticketsTotal} за период`}>
                {d.ticketsByPriority.length === 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Нет заявок за период</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {d.ticketsByPriority.map(p => (
                      <BarRow key={p.priority} label={PRIORITY_META[p.priority]?.label ?? p.priority} value={p.count} max={maxPrio} color={PRIORITY_META[p.priority]?.color ?? '#9CA3AF'} labelWidth={80} />
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          {!isTeamScope && (
            <Card title="Заявки клиентов по статусам" sub={`${d.ticketsTotal} за период`}>
              {ticketSlices.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Нет заявок за период</span>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <Donut slices={ticketSlices.map(s => ({ v: s.count, color: s.color, label: s.label }))} value={d.ticketsTotal} label="заявок" />
                  <div style={{ flex: 1, minWidth: 0 }}><Legend items={ticketSlices} /></div>
                </div>
              )}
            </Card>
          )}

          <div className="card">
            <div className="card__head">
              <span className="card__title">Просроченные задачи</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px',
                borderRadius: 999, fontSize: 11, fontWeight: 600,
                background: 'var(--c-error-light)', color: 'var(--c-error)',
              }}>{d.overdueCount}</span>
            </div>
            <div className="card__body card__body--flush" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="table" style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Название', 'Команда', 'Дедлайн', 'Приоритет'].map(h => (
                      <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.overdue.map((task, i) => (
                    <tr key={task.id} style={{ borderBottom: i < d.overdue.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{task.title}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--c-gray-600)' }}>{task.teamName ?? '—'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--c-error)', fontWeight: 600 }}>{task.deadline.slice(0, 10)}</td>
                      <td style={{ padding: '10px 16px' }}><PriorityBadge priority={task.priority as never} /></td>
                    </tr>
                  ))}
                  {d.overdue.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>Просроченных задач нет</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
