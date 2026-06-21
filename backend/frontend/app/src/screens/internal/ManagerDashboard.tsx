import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Task, Ticket } from '../../types';
import { StatusPill, PriorityBadge, ServiceTag, AppTag, Deadline, Stat, SLABadge } from '../../components';
import { SidebarIcon } from '../../shells';
import { ruDate } from '../../utils/helpers';
import { teamColor } from '../../utils/teamColor';
import { taskSLA, makeServiceLookup } from '../../utils/sla';
import { getServices } from '../../api';

interface Props {
  goto: (screen: string, params?: Record<string, string>) => void;
  openDrawer: (id: string) => void;
  openCreate: () => void;
  tasks: Task[];
  tickets: Ticket[];
}

const exportTasksCSV = (tasks: Task[]) => {
  const rows = [
    ['ID', 'Название', 'Статус', 'Приоритет', 'Команда', 'Дедлайн', 'Создана'],
    ...tasks.map(t => [t.id, t.title, t.status, t.priority, t.team, t.deadline, t.created]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};

export const ManagerDashboard: React.FC<Props> = ({ goto, openDrawer, openCreate, tasks, tickets }) => {
  const [period, setPeriod] = React.useState<'7d' | '30d' | 'q'>('30d');

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (period === '7d' ? 7 : period === '30d' ? 30 : 90));
  const periodTasks = tasks.filter(t => new Date(t.created) >= cutoff);

  const totalActive = periodTasks.filter(t => !['done', 'archive'].includes(t.status)).length;
  const inProgress = periodTasks.filter(t => t.status === 'inprog').length;
  const reviewCount = tasks.filter(t => t.status === 'review').length;
  const newTickets = tickets.filter(t => t.status === 'new').length;
  const doneThisPeriod = periodTasks.filter(t => t.status === 'done').length;

  const servicesQ = useQuery({ queryKey: ['services'], queryFn: () => getServices() });
  const slaLookup = React.useMemo(() => makeServiceLookup(servicesQ.data ?? []), [servicesQ.data]);

  const slaStats = React.useMemo(() => {
    let breached = 0, risk = 0;
    tasks.forEach(t => {
      const s = taskSLA(t, slaLookup).state;
      if (s === 'breached') breached++;
      else if (s === 'risk') risk++;
    });
    return { breached, risk };
  }, [tasks, slaLookup]);

  const periodLabel = period === '7d' ? '7 дней' : period === '30d' ? '30 дней' : 'квартал';

  const incomingTickets: Ticket[] = tickets.filter(t =>
    ['new', 'accepted', 'inprog'].includes(t.status)
  ).slice(0, 4);

  const activeTasks: Task[] = tasks.filter(t =>
    !['draft', 'done', 'reject', 'archive'].includes(t.status)
  ).slice(0, 6);

  const draftTasks: Task[] = tasks.filter(t => t.status === 'draft');

  const teamLoad = React.useMemo(() => {
    const counts = tasks
      .filter(t => !['done', 'archive'].includes(t.status))
      .reduce<Record<string, number>>((acc, t) => {
        if (t.team) acc[t.team] = (acc[t.team] ?? 0) + 1;
        return acc;
      }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: teamColor(label) }));
  }, [tasks]);
  const maxLoad = Math.max(...teamLoad.map(t => t.value), 1);

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Дашборд менеджера</h1>
          <p className="page-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SidebarIcon name="refresh" size={12} />
            обновлено только что
          </p>
        </div>
        <div className="page-header__actions">
          <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
            {(['7d', '30d', 'q'] as const).map(p => (
              <button
                key={p}
                className={`btn btn--sm ${period === p ? 'btn--primary' : 'btn--ghost'}`}
                style={{ borderRadius: 0, border: 'none' }}
                onClick={() => setPeriod(p)}
              >
                {p === '7d' ? '7 дней' : p === '30d' ? '30 дней' : 'Квартал'}
              </button>
            ))}
          </div>
          <button className="btn btn--secondary btn--sm" onClick={() => exportTasksCSV(tasks)}>
            <SidebarIcon name="download" size={14} />
            Экспорт
          </button>
          <button className="btn btn--primary btn--sm" onClick={openCreate}>
            <SidebarIcon name="plus" size={14} />
            Создать задачу
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats">
        <Stat
          label="Активных задач"
          value={totalActive}
          delta={inProgress > 0 ? `${inProgress} в работе` : 'нет активных'}
          deltaDir="flat"
          icon={<SidebarIcon name="list" size={16} />}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
        />
        <Stat
          label="В работе"
          value={inProgress}
          delta={totalActive > 0 ? `из ${totalActive} активных` : 'нет задач'}
          deltaDir="flat"
          icon={<SidebarIcon name="zap" size={16} />}
          iconBg="#FFF7ED"
          iconColor="#EA580C"
        />
        <Stat
          label="На проверке"
          value={reviewCount}
          delta={reviewCount > 0 ? 'ожидают решения' : 'нет задач'}
          deltaDir={reviewCount > 0 ? 'down' : 'flat'}
          alert={reviewCount > 0}
          icon={<SidebarIcon name="eye" size={16} />}
          iconBg={reviewCount > 0 ? '#F5F3FF' : '#F0FDF4'}
          iconColor={reviewCount > 0 ? '#7C3AED' : '#059669'}
        />
        <Stat
          label="Новых заявок"
          value={newTickets}
          delta={newTickets > 0 ? 'ожидают обработки' : 'нет новых'}
          deltaDir={newTickets > 0 ? 'down' : 'flat'}
          alert={newTickets > 0}
          icon={<SidebarIcon name="inbox" size={16} />}
          iconBg={newTickets > 0 ? '#FEF2F2' : '#F0FDF4'}
          iconColor={newTickets > 0 ? '#DC2626' : '#059669'}
        />
        <Stat
          label="SLA под угрозой"
          value={slaStats.risk}
          delta={slaStats.risk > 0 ? `${slaStats.breached} уже нарушено` : 'всё в норме'}
          deltaDir={slaStats.risk > 0 ? 'down' : 'flat'}
          alert={slaStats.risk > 0}
          icon={<SidebarIcon name="alertTri" size={16} />}
          iconBg={slaStats.risk > 0 ? '#FFFBEB' : '#F0FDF4'}
          iconColor={slaStats.risk > 0 ? '#D97706' : '#059669'}
        />
        <Stat
          label="SLA нарушено"
          value={slaStats.breached}
          delta={slaStats.breached > 0 ? 'требует внимания' : 'нарушений нет'}
          deltaDir={slaStats.breached > 0 ? 'down' : 'flat'}
          alert={slaStats.breached > 0}
          icon={<SidebarIcon name="alert" size={16} />}
          iconBg={slaStats.breached > 0 ? '#FEF2F2' : '#F0FDF4'}
          iconColor={slaStats.breached > 0 ? '#DC2626' : '#059669'}
        />
        <Stat
          label="Закрыто за период"
          value={doneThisPeriod}
          delta={`за ${periodLabel}`}
          deltaDir="up"
          icon={<SidebarIcon name="checkCircle" size={16} />}
          iconBg="#F0FDF4"
          iconColor="#059669"
        />
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Incoming tickets */}
          <div className="card">
            <div className="card__head">
              <span className="card__title">Входящие заявки</span>
              <button className="btn btn--ghost btn--sm" onClick={() => goto('tickets')}>
                Все заявки <SidebarIcon name="arrowRight" size={13} />
              </button>
            </div>
            <div className="card__body--flush">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Заявка</th>
                    <th>Приложение</th>
                    <th>Дата</th>
                    <th>Статус</th>
                    <th style={{ width: 1 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {incomingTickets.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13, padding: '20px 0' }}>
                        Нет входящих заявок
                      </td>
                    </tr>
                  )}
                  {incomingTickets.map(ticket => (
                    <tr key={ticket.id} className="table__row-link" onClick={() => goto('tickets', { ticketId: ticket.id })}>
                      <td><span className="mono">{ticket.id}</span></td>
                      <td style={{ maxWidth: 200 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-gray-800)' }}>
                          {ticket.title}
                        </span>
                      </td>
                      <td><AppTag id={ticket.app} /></td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--c-gray-500)' }}>
                        {ruDate(ticket.created)}
                      </td>
                      <td><StatusPill status={ticket.status} /></td>
                      <td>
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ whiteSpace: 'nowrap', gap: 4 }}
                          onClick={e => { e.stopPropagation(); openCreate(); }}
                        >
                          <SidebarIcon name="plus" size={12} />
                          Задача
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active tasks */}
          <div className="card">
            <div className="card__head">
              <span className="card__title">Активные задачи</span>
              <button className="btn btn--ghost btn--sm" onClick={() => goto('tasks')}>
                Все задачи <SidebarIcon name="arrowRight" size={13} />
              </button>
            </div>
            <div className="card__body--flush">
              <table className="table">
                <thead>
                  <tr>
                    <th>Задача</th>
                    <th>Сервис</th>
                    <th>Команда</th>
                    <th>Приоритет</th>
                    <th>SLA</th>
                    <th>Дедлайн</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTasks.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13, padding: '20px 0' }}>
                        Нет активных задач
                      </td>
                    </tr>
                  )}
                  {activeTasks.map(task => (
                    <tr key={task.id} className="table__row-link" onClick={() => openDrawer(task.id)}>
                      <td>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-gray-800)', marginBottom: 2 }}>
                            {task.title}
                          </div>
                          <span className="mono">{task.id}</span>
                        </div>
                      </td>
                      <td><ServiceTag id={task.service} /></td>
                      <td style={{ fontSize: 12, color: 'var(--c-gray-600)' }}>{task.team}</td>
                      <td><PriorityBadge priority={task.priority} /></td>
                      <td><SLABadge info={taskSLA(task, slaLookup)} /></td>
                      <td><Deadline date={task.deadline} compact /></td>
                      <td><StatusPill status={task.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Team load */}
          <div className="card">
            <div className="card__head">
              <span className="card__title">Нагрузка команд</span>
              <span className="card__sub">задач</span>
            </div>
            <div className="card__body">
              {teamLoad.length === 0 && (
                <span style={{ color: 'var(--c-gray-400)', fontSize: 13 }}>Нет данных</span>
              )}
              <div className="bars">
                {teamLoad.map(t => (
                  <div className="bar" key={t.label}>
                    <span className="bar__label">{t.label}</span>
                    <div className="bar__track">
                      <div
                        className="bar__fill"
                        style={{ width: `${(t.value / maxLoad) * 100}%`, background: t.color }}
                      />
                    </div>
                    <span className="bar__value">{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Drafts */}
          <div className="card">
            <div className="card__head">
              <span className="card__title">Черновики</span>
              <span
                style={{
                  background: draftTasks.length > 0 ? '#EFF6FF' : 'var(--c-gray-100)',
                  color: draftTasks.length > 0 ? '#2563EB' : 'var(--c-gray-600)',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {draftTasks.length}
              </span>
            </div>
            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {draftTasks.length === 0 && (
                <span style={{ color: 'var(--c-gray-400)', fontSize: 13 }}>Черновиков нет</span>
              )}
              {draftTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => openDrawer(task.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '10px 12px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-gray-50)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-gray-800)', marginBottom: 4 }}>
                      {task.title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="mono">{task.id}</span>
                      <ServiceTag id={task.service} />
                    </div>
                  </div>
                  <StatusPill status={task.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
