import React from 'react';
import type { Task, TaskStatus } from '../../types';
import { StatusPill, PriorityBadge, ServiceTag, Deadline, Stat } from '../../components';
import { SidebarIcon, ROLE_LABEL } from '../../shells';
import { useAppStore } from '../../store/appStore';
import { useMyTeam } from '../../hooks/useTeam';
import { updateTaskStatus, acceptTask, submitTaskReview } from '../../api';

interface Props {
  openDrawer: (id: string) => void;
  openDecompose: (taskId: string) => void;
  view: string;
  setView: (v: string) => void;
  tasks: Task[];
  setTasks: (fn: (prev: Task[]) => Task[]) => void;
}

// The active board intentionally has NO "Выполнена" column: once a manager
// approves a task (review → done) it leaves the board and moves to the
// separate "Выполненные" view below, so the board only shows live work.
const COLUMNS: { id: TaskStatus; label: string; dot: string }[] = [
  { id: 'assigned', label: 'Назначена',   dot: 'kcol__dot-assigned' },
  { id: 'inprog',   label: 'В работе',    dot: 'kcol__dot-inprog' },
  { id: 'review',   label: 'На проверке', dot: 'kcol__dot-review' },
  { id: 'reject',   label: 'Возвращена',  dot: 'kcol__dot-reject' },
];

export const TeamleadDashboard: React.FC<Props> = ({ openDrawer, openDecompose, view, setView, tasks, setTasks }) => {
  const setToast = useAppStore(s => s.setToast);
  const { teamName, members, isLoading: teamLoading } = useMyTeam();

  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [archiveBusyId, setArchiveBusyId] = React.useState<string | null>(null);

  const persistStatus = (id: string, prevStatus: TaskStatus, newStatus: TaskStatus) => {
    if (prevStatus === newStatus) return;
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: newStatus } : t)));
    updateTaskStatus(id, newStatus).catch(() => {
      setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: prevStatus } : t)));
      setToast({ kind: 'error', msg: 'Не удалось обновить статус задачи' });
    });
  };

  const runAction = async (id: string, action: 'accept' | 'submit', prevStatus: TaskStatus, optimisticStatus: TaskStatus) => {
    setBusyId(id);
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: optimisticStatus } : t)));
    try {
      const updated = action === 'accept' ? await acceptTask(id) : await submitTaskReview(id);
      setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: updated.status } : t)));
      setToast({ kind: 'success', msg: action === 'accept' ? 'Задача принята в работу' : 'Задача отправлена на проверку' });
    } catch (e) {
      setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: prevStatus } : t)));
      setToast({ kind: 'error', msg: (e as Error).message || 'Действие не выполнено' });
    } finally {
      setBusyId(null);
    }
  };

  const handleArchiveTask = async (id: string) => {
    setArchiveBusyId(id);
    const prevStatus = tasks.find(t => t.id === id)?.status;
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: 'archive' } : t)));
    try {
      await updateTaskStatus(id, 'archive');
      setToast({ kind: 'info', msg: 'Задача архивирована' });
    } catch {
      if (prevStatus) setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: prevStatus } : t)));
      setToast({ kind: 'error', msg: 'Не удалось архивировать задачу' });
    } finally {
      setArchiveBusyId(null);
    }
  };

  const handleArchiveAllDone = async () => {
    const doneTasks = teamTasks.filter(t => t.status === 'done');
    if (doneTasks.length === 0) return;
    setTasks(prev => prev.map(t => (t.team === teamName && t.status === 'done' ? { ...t, status: 'archive' } : t)));
    try {
      await Promise.all(doneTasks.map(t => updateTaskStatus(t.id, 'archive')));
      setToast({ kind: 'info', msg: `Архивировано задач: ${doneTasks.length}` });
    } catch {
      setToast({ kind: 'error', msg: 'Часть задач не удалось архивировать' });
    }
  };

  const onDragStart = (id: string) => (e: React.DragEvent) => { e.dataTransfer.setData('text/plain', id); setDraggingId(id); };
  const onDragEnd = () => { setDraggingId(null); setDropTarget(null); };
  const onDragOver = (colId: string) => (e: React.DragEvent) => { e.preventDefault(); setDropTarget(colId); };
  const onDragLeave = () => setDropTarget(null);
  const onDrop = (colId: TaskStatus) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const prev = tasks.find(t => t.id === id)?.status;
    if (id && prev) persistStatus(id, prev, colId);
    setDraggingId(null); setDropTarget(null);
  };

  const teamTasks = tasks.filter(t => t.team === teamName);
  // Active board excludes finished work. The "Выполненные" view holds approved
  // (done) tasks only — once the teamlead removes one it's archived and gone
  // from their side entirely; only a manager can bring it back.
  const activeTasks = teamTasks.filter(t => t.status !== 'done' && t.status !== 'archive');
  const completedTasks = teamTasks.filter(t => t.status === 'done');
  const inprogCount = teamTasks.filter(t => t.status === 'inprog').length;
  const reviewCount = teamTasks.filter(t => t.status === 'review').length;
  const doneCount = teamTasks.filter(t => t.status === 'done').length;
  const rejectCount = teamTasks.filter(t => t.status === 'reject').length;
  const overdueCount = teamTasks.filter(t => {
    if (!t.deadline) return false;
    const dl = new Date(t.deadline + 'T23:59:59');
    return dl < new Date() && t.status !== 'done' && t.status !== 'archive';
  }).length;

  // Active subtask count per member (for workload display in sidebar and team view)
  const subtasksByWorker = React.useMemo(() => {
    const map: Record<string, number> = {};
    teamTasks.forEach(t => t.subtasks.forEach(s => {
      if (s.status !== 'done') map[s.worker] = (map[s.worker] ?? 0) + 1;
    }));
    return map;
  }, [teamTasks]);

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{`Команда ${teamName}`}</h1>
          <p className="page-sub">Управление задачами и нагрузкой команды</p>
        </div>
        <div className="page-header__actions">
          <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              className={`btn btn--sm ${view === 'kanban' ? 'btn--primary' : 'btn--ghost'}`}
              style={{ borderRadius: 0, border: 'none', gap: 5 }}
              onClick={() => setView('kanban')}
            >
              <SidebarIcon name="kanban" size={14} />
              Канбан
            </button>
            <button
              className={`btn btn--sm ${view === 'list' ? 'btn--primary' : 'btn--ghost'}`}
              style={{ borderRadius: 0, border: 'none', gap: 5 }}
              onClick={() => setView('list')}
            >
              <SidebarIcon name="list" size={14} />
              Список
            </button>
            <button
              className={`btn btn--sm ${view === 'done' ? 'btn--primary' : 'btn--ghost'}`}
              style={{ borderRadius: 0, border: 'none', gap: 5 }}
              onClick={() => setView('done')}
            >
              <SidebarIcon name="checkCircle" size={14} />
              Выполненные
              {completedTasks.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, background: view === 'done' ? 'rgba(255,255,255,.25)' : 'var(--c-gray-100)', color: view === 'done' ? '#fff' : 'var(--c-gray-600)', padding: '0 6px', borderRadius: 999 }}>
                  {completedTasks.length}
                </span>
              )}
            </button>
            <button
              className={`btn btn--sm ${view === 'team' ? 'btn--primary' : 'btn--ghost'}`}
              style={{ borderRadius: 0, border: 'none', gap: 5 }}
              onClick={() => setView('team')}
            >
              <SidebarIcon name="users" size={14} />
              Команда
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        <Stat label="В работе" value={inprogCount} />
        <Stat label="На проверке" value={reviewCount} />
        <Stat label="Выполнено" value={doneCount} />
        <Stat label="Возвращено" value={rejectCount} alert={rejectCount > 0} />
        <Stat label="Просрочено" value={overdueCount} alert={overdueCount > 0} />
      </div>

      {/* Team view — member-centric */}
      {view === 'team' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {teamLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13, gridColumn: '1 / -1' }}>Загрузка…</div>
          ) : members.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13, gridColumn: '1 / -1' }}>Нет участников команды</div>
          ) : members.map(member => {
            const memberSubs = teamTasks.flatMap(t =>
              t.subtasks
                .filter(s => s.worker === member.id && s.status !== 'done')
                .map(s => ({ ...s, taskTitle: t.title, taskId: t.id }))
            );
            return (
              <div key={member.id} className="card" style={{ alignSelf: 'start' }}>
                <div className="card__head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: '50%', background: member.color,
                      color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {member.avatar}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-gray-800)', lineHeight: 1.2 }}>{member.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-gray-500)' }}>{ROLE_LABEL[member.role] ?? member.role}</div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    background: memberSubs.length > 0 ? 'var(--c-blue-50)' : 'var(--c-gray-100)',
                    color: memberSubs.length > 0 ? 'var(--c-blue-600)' : 'var(--c-gray-400)',
                    padding: '2px 8px', borderRadius: 999,
                  }}>
                    {memberSubs.length} подзадач
                  </span>
                </div>
                <div className="card__body" style={{ padding: 0 }}>
                  {memberSubs.length === 0 ? (
                    <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--c-gray-400)', textAlign: 'center' }}>
                      Нет активных подзадач
                    </div>
                  ) : memberSubs.slice(0, 6).map(sub => (
                    <div
                      key={sub.id}
                      style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                      onClick={() => openDrawer(sub.taskId)}
                    >
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-gray-800)', marginBottom: 4 }}>{sub.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <StatusPill status={sub.status} />
                        <span style={{ fontSize: 11, color: 'var(--c-gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                          {sub.taskTitle}
                        </span>
                        {sub.deadline && <Deadline date={sub.deadline} compact />}
                      </div>
                    </div>
                  ))}
                  {memberSubs.length > 6 && (
                    <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--c-blue-600)' }}>
                      + ещё {memberSubs.length - 6} подзадач
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed (approved) + archived tasks live here, off the active board */}
      {view === 'done' && (
        <div className="card">
          <div className="card__head">
            <span className="card__title">Выполненные задачи</span>
            {doneCount > 0 && (
              <button className="btn btn--ghost btn--sm" style={{ color: 'var(--c-gray-500)', gap: 5 }} onClick={handleArchiveAllDone}>
                <SidebarIcon name="archive" size={13} />
                Убрать все ({doneCount})
              </button>
            )}
          </div>
          <div className="card__body--flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Задача</th>
                  <th>Сервис</th>
                  <th>Приоритет</th>
                  <th>Подзадачи</th>
                  <th>Дедлайн</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {completedTasks.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>Пока нет выполненных задач</td></tr>
                ) : completedTasks.map(task => {
                  const totalSubs = task.subtasks.length;
                  const doneSubs = task.subtasks.filter(s => s.status === 'done').length;
                  return (
                    <tr key={task.id} className="table__row-link" onClick={() => openDrawer(task.id)}>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-gray-800)', marginBottom: 2 }}>{task.title}</div>
                        <span className="mono">{task.id}</span>
                      </td>
                      <td><ServiceTag id={task.service} /></td>
                      <td><PriorityBadge priority={task.priority} /></td>
                      <td style={{ fontSize: 12, color: 'var(--c-gray-500)' }}>
                        {totalSubs > 0 ? `${doneSubs}/${totalSubs}` : '—'}
                      </td>
                      <td><Deadline date={task.deadline} compact /></td>
                      <td><StatusPill status={task.status} /></td>
                      <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn--ghost btn--sm" style={{ color: 'var(--c-gray-500)' }} disabled={archiveBusyId === task.id} title="Убрать из выполненных (в архив). Вернуть сможет только менеджер." onClick={() => handleArchiveTask(task.id)}>
                          <SidebarIcon name="archive" size={12} /> {archiveBusyId === task.id ? '…' : 'Убрать'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kanban + List views share the two-column layout */}
      {(view === 'kanban' || view === 'list') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>
          <div>
            {/* Kanban */}
            {view === 'kanban' && (
              <div className="kanban" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {COLUMNS.map(col => {
                  const colTasks = teamTasks.filter(t => t.status === col.id);
                  const isTarget = dropTarget === col.id;
                  return (
                    <div
                      key={col.id}
                      className="kcol"
                      onDragOver={onDragOver(col.id)}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop(col.id)}
                      style={isTarget ? { outline: '2px dashed var(--c-blue-600)', outlineOffset: -2 } : {}}
                    >
                      <div className="kcol__head">
                        <span className="kcol__title">
                          <span className={`kcol__dot ${col.dot}`} />
                          {col.label}
                        </span>
                        <span className="kcol__count">{colTasks.length}</span>
                      </div>
                      <div className="kcol__drop">
                        {colTasks.map(task => {
                          const totalSubs = task.subtasks.length;
                          const doneSubs = task.subtasks.filter(s => s.status === 'done').length;
                          return (
                            <div
                              key={task.id}
                              className={`kcard${draggingId === task.id ? ' is-dragging' : ''}`}
                              draggable
                              onDragStart={onDragStart(task.id)}
                              onDragEnd={onDragEnd}
                              onClick={() => openDrawer(task.id)}
                            >
                              <p className="kcard__title">{task.title}</p>
                              <div className="kcard__meta">
                                <ServiceTag id={task.service} />
                                <PriorityBadge priority={task.priority} />
                              </div>

                              {/* Subtask progress */}
                              {totalSubs > 0 && (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-gray-500)', marginBottom: 3 }}>
                                    <span>Подзадачи</span>
                                    <span>{doneSubs}/{totalSubs}</span>
                                  </div>
                                  <div style={{ height: 3, background: 'var(--c-gray-200)', borderRadius: 2 }}>
                                    <div style={{ height: '100%', width: `${Math.round(doneSubs / totalSubs * 100)}%`, background: doneSubs === totalSubs ? 'var(--c-success)' : 'var(--c-blue-500)', borderRadius: 2, transition: 'width 200ms' }} />
                                  </div>
                                </div>
                              )}

                              {/* Rejection reason */}
                              {task.status === 'reject' && task.rejectReason && (
                                <div style={{ marginTop: 8, padding: '6px 8px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, fontSize: 11, color: '#92400E', lineHeight: 1.4 }}>
                                  <strong>Причина:</strong> {task.rejectReason}
                                </div>
                              )}

                              {/* Workflow shortcuts */}
                              {(task.status === 'assigned' || task.status === 'inprog' || task.status === 'reject') && (
                                <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                                  {task.status === 'assigned' && (
                                    <button
                                      className="btn btn--primary btn--sm"
                                      style={{ width: '100%', justifyContent: 'center', gap: 5 }}
                                      disabled={busyId === task.id}
                                      onClick={() => runAction(task.id, 'accept', 'assigned', 'inprog')}
                                    >
                                      <SidebarIcon name="zap" size={12} />
                                      {busyId === task.id ? '…' : 'Принять в работу'}
                                    </button>
                                  )}
                                  {task.status === 'inprog' && (() => {
                                    const canSubmit = totalSubs === 0 || doneSubs === totalSubs;
                                    return (
                                      <button
                                        className="btn btn--secondary btn--sm"
                                        style={{ width: '100%', justifyContent: 'center', gap: 5 }}
                                        disabled={busyId === task.id || !canSubmit}
                                        title={canSubmit ? 'Отправить на проверку менеджеру' : `Сначала закройте все подзадачи (${doneSubs}/${totalSubs})`}
                                        onClick={() => runAction(task.id, 'submit', 'inprog', 'review')}
                                      >
                                        <SidebarIcon name="check" size={12} />
                                        {busyId === task.id ? '…' : canSubmit ? 'На проверку' : `Подзадачи ${doneSubs}/${totalSubs}`}
                                      </button>
                                    );
                                  })()}
                                  {task.status === 'reject' && (
                                    <button
                                      className="btn btn--outline btn--sm"
                                      style={{ width: '100%', justifyContent: 'center', gap: 5 }}
                                      disabled={busyId === task.id}
                                      onClick={() => persistStatus(task.id, 'reject', 'inprog')}
                                    >
                                      <SidebarIcon name="refresh" size={12} />
                                      {busyId === task.id ? '…' : 'Взять в работу'}
                                    </button>
                                  )}
                                </div>
                              )}

                              <div className="kcard__foot">
                                <button
                                  onClick={e => { e.stopPropagation(); openDecompose(task.id); }}
                                  style={{ fontSize: 10, color: 'var(--c-blue-500)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}
                                  title="Декомпозиция задачи"
                                >
                                  <SidebarIcon name="layers" size={10} />
                                  {totalSubs === 0 ? 'Разобрать' : 'Подзадачи'}
                                </button>
                                <Deadline date={task.deadline} compact />
                              </div>
                            </div>
                          );
                        })}
                        {col.id === 'assigned' && (
                          <button
                            className="btn btn--ghost btn--sm"
                            style={{ width: '100%', justifyContent: 'center', color: 'var(--c-gray-400)', marginTop: 4 }}
                            onClick={() => openDecompose('')}
                          >
                            <SidebarIcon name="plus" size={13} />
                            Добавить подзадачу
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* List */}
            {view === 'list' && (
              <div className="card">
                <div className="card__body--flush">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Задача</th>
                        <th>Сервис</th>
                        <th>Приоритет</th>
                        <th>Подзадачи</th>
                        <th>Дедлайн</th>
                        <th>Статус</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTasks.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>Нет активных задач команды</td></tr>
                      ) : activeTasks.map(task => {
                        const totalSubs = task.subtasks.length;
                        const doneSubs = task.subtasks.filter(s => s.status === 'done').length;
                        return (
                          <tr key={task.id} className="table__row-link" onClick={() => openDrawer(task.id)}>
                            <td>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-gray-800)', marginBottom: 2 }}>{task.title}</div>
                              <span className="mono">{task.id}</span>
                              {task.status === 'reject' && task.rejectReason && (
                                <div style={{ fontSize: 11, color: '#92400E', marginTop: 3 }}>↩ {task.rejectReason}</div>
                              )}
                            </td>
                            <td><ServiceTag id={task.service} /></td>
                            <td><PriorityBadge priority={task.priority} /></td>
                            <td onClick={e => e.stopPropagation()}>
                              {totalSubs > 0 ? (
                                <button
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: doneSubs === totalSubs ? 'var(--c-success)' : 'var(--c-gray-600)' }}
                                  onClick={() => openDecompose(task.id)}
                                  title="Открыть декомпозицию"
                                >
                                  <SidebarIcon name="layers" size={12} />
                                  {doneSubs}/{totalSubs}
                                </button>
                              ) : (
                                <button
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, color: 'var(--c-gray-400)', display: 'flex', alignItems: 'center', gap: 4 }}
                                  onClick={() => openDecompose(task.id)}
                                >
                                  <SidebarIcon name="plus" size={11} />
                                  Разобрать
                                </button>
                              )}
                            </td>
                            <td><Deadline date={task.deadline} compact /></td>
                            <td><StatusPill status={task.status} /></td>
                            <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                              {task.status === 'assigned' && (
                                <button className="btn btn--primary btn--sm" disabled={busyId === task.id} onClick={() => runAction(task.id, 'accept', 'assigned', 'inprog')}>Принять</button>
                              )}
                              {task.status === 'inprog' && (
                                <button
                                  className="btn btn--secondary btn--sm"
                                  disabled={busyId === task.id || !(totalSubs === 0 || doneSubs === totalSubs)}
                                  title={totalSubs === 0 || doneSubs === totalSubs ? 'Отправить на проверку' : `Сначала закройте все подзадачи (${doneSubs}/${totalSubs})`}
                                  onClick={() => runAction(task.id, 'submit', 'inprog', 'review')}
                                >
                                  {totalSubs === 0 || doneSubs === totalSubs ? 'На проверку' : `Подзадачи ${doneSubs}/${totalSubs}`}
                                </button>
                              )}
                              {task.status === 'reject' && (
                                <button className="btn btn--outline btn--sm" disabled={busyId === task.id} onClick={() => persistStatus(task.id, 'reject', 'inprog')}>
                                  <SidebarIcon name="refresh" size={12} /> Взять в работу
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Team sidebar */}
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="card__head">
              <span className="card__title">{`Команда ${teamName}`}</span>
              <span style={{ fontSize: 12, color: 'var(--c-gray-400)' }}>{members.length} чел.</span>
            </div>
            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {teamLoading ? (
                <div style={{ fontSize: 13, color: 'var(--c-gray-400)', textAlign: 'center', padding: 12 }}>Загрузка…</div>
              ) : members.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--c-gray-400)', textAlign: 'center', padding: 12 }}>Нет участников</div>
              ) : members.map(member => {
                const active = subtasksByWorker[member.id] ?? 0;
                return (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, borderRadius: '50%', background: member.color,
                      color: '#fff', fontSize: 10, fontWeight: 600, flexShrink: 0,
                    }}>
                      {member.avatar}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-gray-500)' }}>{ROLE_LABEL[member.role] ?? member.role}</div>
                    </div>
                    {active > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--c-blue-50)', color: 'var(--c-blue-600)', padding: '2px 6px', borderRadius: 999, flexShrink: 0 }}>
                        {active}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
