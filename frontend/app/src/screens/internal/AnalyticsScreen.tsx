import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarOutlined, PrinterOutlined } from '@ant-design/icons';
import { Stat, Donut, LineChart } from '../../components';
import { PriorityBadge } from '../../components';
import { useAppStore } from '../../store/appStore';
import { teamColor } from '../../utils/teamColor';
import { taskSLA, makeServiceLookup, SLA_COLORS } from '../../utils/sla';
import { getServices } from '../../api';

const STATUS_META: Array<{ status: string; color: string; label: string }> = [
  { status: 'inprog',   color: '#D97706', label: 'В работе' },
  { status: 'done',     color: '#059669', label: 'Выполнена' },
  { status: 'assigned', color: '#2563EB', label: 'Назначена' },
  { status: 'review',   color: '#7C3AED', label: 'На проверке' },
  { status: 'reject',   color: '#DC2626', label: 'Отклонена' },
  { status: 'draft',    color: '#6B7280', label: 'Черновик' },
  { status: 'archive',  color: '#9CA3AF', label: 'Архив' },
];

const TICKET_STATUS_META: Array<{ status: string; color: string; label: string }> = [
  { status: 'new',      color: '#2563EB', label: 'Новые' },
  { status: 'inprog',   color: '#D97706', label: 'В обработке' },
  { status: 'accepted', color: '#0D9488', label: 'В работе' },
  { status: 'closed',   color: '#059669', label: 'Закрыты' },
  { status: 'rejected', color: '#DC2626', label: 'Отклонены' },
];

const PRIORITY_META: Record<string, { color: string; label: string }> = {
  critical: { color: '#DC2626', label: 'Критичный' },
  high:     { color: '#F97316', label: 'Высокий' },
  medium:   { color: '#2563EB', label: 'Средний' },
  low:      { color: '#9CA3AF', label: 'Низкий' },
};


const Legend: React.FC<{ items: Array<{ v: number; color: string; label: string }> }> = ({ items }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {items.map((it, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--c-gray-700)' }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{it.label}</span>
        <span className="bold mono" style={{ color: 'var(--c-gray-900)' }}>{it.v}</span>
      </div>
    ))}
  </div>
);

const PERIOD_OPTIONS = [
  { id: '7d',  label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: '90d', label: '90 дней' },
  { id: 'all', label: 'За всё время' },
] as const;
type Period = typeof PERIOD_OPTIONS[number]['id'];

export const AnalyticsScreen: React.FC = () => {
  const allTasks = useAppStore(s => s.tasks);
  const tickets = useAppStore(s => s.tickets);
  const role = useAppStore(s => s.role);
  const currentUser = useAppStore(s => s.currentUser);
  const servicesQ = useQuery({ queryKey: ['services'], queryFn: () => getServices() });
  const slaLookup = React.useMemo(() => makeServiceLookup(servicesQ.data ?? []), [servicesQ.data]);

  const isTeamlead = role === 'teamlead';
  const isManagerOrAdmin = role === 'manager' || role === 'admin';
  const myTeam = currentUser?.team ?? '';

  // Teamlead sees only their own team; manager/admin see everything.
  const tasks = React.useMemo(
    () => (isTeamlead && myTeam ? allTasks.filter(t => t.team === myTeam) : allTasks),
    [allTasks, isTeamlead, myTeam],
  );

  const [period, setPeriod] = React.useState<Period>('30d');
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

  const today = new Date().toISOString().slice(0, 10);

  const filteredTasks = React.useMemo(() => {
    if (period === 'all') return tasks;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (period === '7d' ? 7 : period === '30d' ? 30 : 90));
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return tasks.filter(t => t.created >= cutoffStr);
  }, [tasks, period]);

  const lcData = React.useMemo(() => {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const buckets = period === 'all' ? 8 : Math.min(8, Math.ceil(days / 2));
    const step = period === 'all' ? 14 : Math.ceil(days / buckets);
    const base = new Date();
    return Array.from({ length: buckets }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() - (buckets - 1 - i) * step);
      const next = new Date(d);
      next.setDate(next.getDate() + step);
      const start = d.toISOString().slice(0, 10);
      const end = next.toISOString().slice(0, 10);
      return {
        label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`,
        created: tasks.filter(t => t.created >= start && t.created < end).length,
        closed: tasks.filter(t => ['done', 'archive'].includes(t.status) && t.created >= start && t.created < end).length,
      };
    });
  }, [tasks, period]);

  const avgBars = React.useMemo(() => {
    const acc: Record<string, { total: number; count: number }> = {};
    filteredTasks.filter(t => t.status === 'done').forEach(t => {
      const days = Math.max(1, Math.round(
        (new Date(t.deadline).getTime() - new Date(t.created).getTime()) / 86_400_000
      ));
      if (!acc[t.team]) acc[t.team] = { total: 0, count: 0 };
      acc[t.team].total += days;
      acc[t.team].count += 1;
    });
    return Object.entries(acc).map(([label, { total, count }]) => ({
      label,
      value: Math.round((total / count) * 10) / 10,
      color: teamColor(label),
    }));
  }, [filteredTasks]);

  const total = filteredTasks.length;
  const done = filteredTasks.filter(t => t.status === 'done').length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
  const overdueTasks = filteredTasks.filter(
    t => t.deadline < today && !['done', 'archive'].includes(t.status)
  );
  const activeTickets = tickets.filter(t => !['closed', 'rejected'].includes(t.status)).length;

  const sla = React.useMemo(() => {
    let ok = 0, risk = 0, breached = 0;
    filteredTasks.forEach(t => {
      const s = taskSLA(t, slaLookup).state;
      if (s === 'ok') ok++;
      else if (s === 'risk') risk++;
      else if (s === 'breached') breached++;
    });
    const tracked = ok + risk + breached;
    const compliance = tracked > 0 ? Math.round((ok / tracked) * 100) : 100;
    return { ok, risk, breached, tracked, compliance };
  }, [filteredTasks, slaLookup]);

  const donutSlices = STATUS_META
    .map(m => ({ v: filteredTasks.filter(t => t.status === m.status).length, color: m.color, label: m.label }))
    .filter(s => s.v > 0);

  const teamCounts = filteredTasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.team] = (acc[t.team] ?? 0) + 1;
    return acc;
  }, {});
  const teamBars = Object.entries(teamCounts).map(([label, value]) => ({
    label,
    value,
    color: teamColor(label),
  }));
  const maxTeam = Math.max(...teamBars.map(b => b.value), 1);

  // Teamlead: workload per team member, from active subtasks across scoped tasks.
  const workerLoad = React.useMemo(() => {
    const acc: Record<string, { active: number; done: number }> = {};
    filteredTasks.forEach(t => (t.subtasks ?? []).forEach(s => {
      const name = s.workerName || s.worker || '—';
      if (!acc[name]) acc[name] = { active: 0, done: 0 };
      if (s.status === 'done') acc[name].done += 1;
      else acc[name].active += 1;
    }));
    return Object.entries(acc)
      .map(([label, v]) => ({ label, ...v, total: v.active + v.done }))
      .sort((a, b) => b.active - a.active);
  }, [filteredTasks]);
  const maxWorkerLoad = Math.max(...workerLoad.map(w => w.total), 1);

  // Manager/admin: client ticket funnel + priority breakdown.
  const ticketStats = React.useMemo(() => {
    const cutoffStr = period === 'all'
      ? ''
      : (() => { const c = new Date(); c.setDate(c.getDate() - (period === '7d' ? 7 : period === '30d' ? 30 : 90)); return c.toISOString().slice(0, 10); })();
    const scoped = period === 'all' ? tickets : tickets.filter(t => (t.created ?? '').slice(0, 10) >= cutoffStr);
    const byStatus = TICKET_STATUS_META
      .map(m => ({ ...m, v: scoped.filter(t => t.status === m.status).length }))
      .filter(s => s.v > 0);
    const byPriority = (['critical', 'high', 'medium', 'low'] as const)
      .map(p => ({ priority: p, v: scoped.filter(t => t.priority === p).length }))
      .filter(p => p.v > 0);
    return { total: scoped.length, byStatus, byPriority };
  }, [tickets, period]);

  const periodLabel = PERIOD_OPTIONS.find(p => p.id === period)?.label ?? '';

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {isTeamlead ? 'Аналитика команды' : 'Аналитика'}
          </h1>
          <p className="page-sub muted" style={{ margin: 0, marginTop: 2 }}>
            {isTeamlead
              ? (myTeam ? `Команда «${myTeam}» · сводка за период` : 'Сводка за период')
              : 'Сводка по всем командам за период'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              className="btn btn--outline"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setShowPeriodMenu(v => !v)}
            >
              <CalendarOutlined /> {periodLabel}
            </button>
            {showPeriodMenu && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
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
                  }}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn--primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => window.print()}>
            <PrinterOutlined /> PDF-отчёт
          </button>
        </div>
      </div>

      {}
      <div className="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        <Stat label="Всего задач" value={total} />
        <Stat label="Выполнено" value={done} />
        <Stat label="Выполнение" value={`${completionRate}%`} />
        <Stat label="Соблюдение SLA" value={`${sla.compliance}%`} alert={sla.breached > 0} />
        <Stat label="Просрочено" value={overdueTasks.length} alert={overdueTasks.length > 0} />
        <Stat label="Активных заявок" value={activeTickets} />
      </div>

      {}
      <div className="card">
        <div className="card__head">
          <span className="card__title">Соблюдение SLA</span>
          <span className="card__sub muted">по открытым задачам · {sla.tracked} с SLA</span>
        </div>
        <div className="card__body" style={{ padding: 16 }}>
          {sla.tracked === 0 ? (
            <span style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Нет открытых задач с настроенным SLA</span>
          ) : (
            <>
              <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
                {([['ok', sla.ok], ['risk', sla.risk], ['breached', sla.breached]] as const).map(([state, v]) =>
                  v > 0 ? (
                    <div key={state} style={{ width: `${(v / sla.tracked) * 100}%`, background: SLA_COLORS[state] }} />
                  ) : null
                )}
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {([['ok', 'В норме', sla.ok], ['risk', 'Под угрозой', sla.risk], ['breached', 'Нарушено', sla.breached]] as const).map(([state, label, v]) => (
                  <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--c-gray-700)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: SLA_COLORS[state], flexShrink: 0 }} />
                    {label}
                    <span className="bold mono" style={{ color: 'var(--c-gray-900)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {}
        <div className="card">
          <div className="card__head">
            <span className="card__title">Задачи по статусам</span>
          </div>
          <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 16 }}>
            <Donut slices={donutSlices} value={total} label="задач" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Legend items={donutSlices} />
            </div>
          </div>
        </div>

        {}
        <div className="card">
          <div className="card__head">
            <span className="card__title">Создано vs Закрыто</span>
          </div>
          <div className="card__body" style={{ padding: 16 }}>
            <div style={{ position: 'relative' }}>
              <LineChart
                data={lcData.map(d => ({ label: d.label, value: d.created }))}
                color="#2563EB"
                height={110}
              />
            </div>
            <div style={{ position: 'relative', marginTop: -8 }}>
              <LineChart
                data={lcData.map(d => ({ label: d.label, value: d.closed }))}
                color="#059669"
                height={110}
              />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--c-gray-600)' }}>
                <span style={{ width: 12, height: 3, borderRadius: 2, background: '#2563EB', display: 'inline-block' }} />
                Создано
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--c-gray-600)' }}>
                <span style={{ width: 12, height: 3, borderRadius: 2, background: '#059669', display: 'inline-block' }} />
                Закрыто
              </div>
            </div>
          </div>
        </div>

        {}
        <div className="card">
          <div className="card__head">
            <span className="card__title">Среднее время выполнения</span>
            <span className="card__sub muted">дней</span>
          </div>
          <div className="card__body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {avgBars.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Нет завершённых задач</span>
            ) : (() => {
              const maxAvg = Math.max(...avgBars.map(b => b.value), 1);
              return avgBars.map(b => (
                <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--c-gray-600)', width: 70, flexShrink: 0 }}>{b.label}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--c-gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(b.value / maxAvg) * 100}%`, background: b.color, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--c-gray-700)', width: 36, textAlign: 'right', flexShrink: 0 }}>{b.value}</span>
                </div>
              ));
            })()}
          </div>
        </div>

        {}
        {isTeamlead ? (
          <div className="card">
            <div className="card__head">
              <span className="card__title">Загрузка сотрудников</span>
              <span className="card__sub muted">активные · всего подзадач</span>
            </div>
            <div className="card__body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {workerLoad.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Нет подзадач за период</span>
              ) : workerLoad.map(w => (
                <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--c-gray-600)', width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.label}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--c-gray-100)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ height: '100%', width: `${(w.active / maxWorkerLoad) * 100}%`, background: '#D97706', transition: 'width 0.4s' }} />
                    <div style={{ height: '100%', width: `${(w.done / maxWorkerLoad) * 100}%`, background: '#059669', transition: 'width 0.4s' }} />
                  </div>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--c-gray-700)', width: 48, textAlign: 'right', flexShrink: 0 }}>{w.active}/{w.total}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card__head">
              <span className="card__title">Нагрузка команд</span>
              <span className="card__sub muted">задач</span>
            </div>
            <div className="card__body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {teamBars.map((b) => (
                <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--c-gray-600)', width: 70, flexShrink: 0 }}>{b.label}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--c-gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${(b.value / maxTeam) * 100}%`,
                        background: b.color,
                        borderRadius: 4,
                        transition: 'width 0.4s',
                      }}
                    />
                  </div>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--c-gray-700)', width: 24, textAlign: 'right', flexShrink: 0 }}>{b.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isManagerOrAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card__head">
              <span className="card__title">Заявки клиентов по статусам</span>
              <span className="card__sub muted">{ticketStats.total} за период</span>
            </div>
            <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 16 }}>
              {ticketStats.total === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Нет заявок за период</span>
              ) : (
                <>
                  <Donut slices={ticketStats.byStatus.map(s => ({ v: s.v, color: s.color, label: s.label }))} value={ticketStats.total} label="заявок" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Legend items={ticketStats.byStatus.map(s => ({ v: s.v, color: s.color, label: s.label }))} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <span className="card__title">Заявки по приоритету</span>
            </div>
            <div className="card__body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ticketStats.byPriority.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Нет заявок за период</span>
              ) : (() => {
                const maxP = Math.max(...ticketStats.byPriority.map(p => p.v), 1);
                return ticketStats.byPriority.map(p => {
                  const meta = PRIORITY_META[p.priority];
                  return (
                    <div key={p.priority} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--c-gray-600)', width: 80, flexShrink: 0 }}>{meta.label}</span>
                      <div style={{ flex: 1, height: 8, background: 'var(--c-gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(p.v / maxP) * 100}%`, background: meta.color, borderRadius: 4, transition: 'width 0.4s' }} />
                      </div>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--c-gray-700)', width: 24, textAlign: 'right', flexShrink: 0 }}>{p.v}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {}
      <div className="card">
        <div className="card__head">
          <span className="card__title">Просроченные задачи</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 20,
              padding: '0 7px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--c-error-light)',
              color: 'var(--c-error)',
            }}
          >
            {overdueTasks.length}
          </span>
        </div>
        <div className="card__body card__body--flush">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>ID</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>Название</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>Команда</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>Дедлайн</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>Приоритет</th>
              </tr>
            </thead>
            <tbody>
              {overdueTasks.map((task, i) => (
                <tr key={task.id} className="table__row-link" style={{ borderBottom: i < overdueTasks.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--c-blue-600)', fontWeight: 600 }}>{task.id}</span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{task.title}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--c-gray-600)' }}>{task.team}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--c-error)', fontWeight: 600 }}>{task.deadline}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <PriorityBadge priority={task.priority} />
                  </td>
                </tr>
              ))}
              {overdueTasks.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>
                    Просроченных задач нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
