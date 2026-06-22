import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, SubtaskStatus, Subtask } from '../../types';
import { StatusPill, PriorityBadge, Deadline, Stat, Attachments } from '../../components';
import { SidebarIcon } from '../../shells';
import { useAppStore } from '../../store/appStore';
import { getMySubtasks, updateSubtask } from '../../api';

interface Props {
  openDrawer: (id: string) => void;
  tasks: Task[];
  setTasks: (fn: (prev: Task[]) => Task[]) => void;
}

const STATUS_CONFIG: { status: SubtaskStatus; label: string; color: string; dot: string }[] = [
  { status: 'todo',    label: 'К выполнению',  color: '#2563EB', dot: 'kcol__dot-assigned' },
  { status: 'inprog',  label: 'В работе',       color: '#D97706', dot: 'kcol__dot-inprog' },
  { status: 'blocked', label: 'Заблокировано',  color: '#7C3AED', dot: 'kcol__dot-review' },
  { status: 'done',    label: 'Выполнено',      color: '#059669', dot: 'kcol__dot-done' },
];



export const WorkerScreen: React.FC<Props> = ({ openDrawer, tasks }) => {
  const qc = useQueryClient();
  const currentUser = useAppStore(s => s.currentUser);
  const setToast = useAppStore(s => s.setToast);
  const userId = currentUser?.id;
  const userName = currentUser?.name ?? 'Сотрудник';

  const [view, setView] = React.useState<'list' | 'kanban'>('list');
  const [showDone, setShowDone] = React.useState(false);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);

  const subtasksQ = useQuery({
    queryKey: ['my-subtasks', userId],
    queryFn: () => getMySubtasks(userId),
  });

  const parentTask = (taskId?: string) => tasks.find(t => t.id === taskId);

  const statusM = useMutation({
    mutationFn: ({ sub, status }: { sub: Subtask; status: SubtaskStatus }) =>
      updateSubtask(sub.taskId ?? '', sub.id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-subtasks', userId] }),
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message || 'Не удалось обновить статус' }),
  });

  const setStatus = (sub: Subtask, status: SubtaskStatus) => statusM.mutate({ sub, status });

  const allSubtasks = subtasksQ.data ?? [];
  const now = new Date();

  const activeCount  = allSubtasks.filter(s => s.status === 'todo' || s.status === 'inprog').length;
  const blockedCount = allSubtasks.filter(s => s.status === 'blocked').length;
  const doneCount    = allSubtasks.filter(s => s.status === 'done').length;
  const overdueCount = allSubtasks.filter(s => {
    if (!s.deadline || s.status === 'done') return false;
    return new Date(s.deadline + 'T23:59:59') < now;
  }).length;

  const visibleSubtasks = showDone ? allSubtasks : allSubtasks.filter(s => s.status !== 'done');


  const onDragStart = (id: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggingId(id);
  };
  const onDragEnd = () => { setDraggingId(null); setDropTarget(null); };
  const onDragOver = (colId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    // "Выполнено" is teamlead-only — don't invite a drop there.
    if (colId === 'done') return;
    setDropTarget(colId);
  };
  const onDragLeave = () => setDropTarget(null);
  const onDrop = (colStatus: SubtaskStatus) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const sub = allSubtasks.find(s => s.id === id);
    setDraggingId(null); setDropTarget(null);
    if (!sub || sub.status === colStatus) return;
    // Completion is confirmed by the teamlead — a worker can't move a subtask
    // into "Выполнено", nor reopen one the teamlead already closed.
    if (colStatus === 'done' || sub.status === 'done') {
      setToast({ kind: 'info', msg: 'Отметить подзадачу выполненной может только тимлид' });
      return;
    }
    setStatus(sub, colStatus);
  };


  const SubtaskCard: React.FC<{ sub: Subtask }> = ({ sub }) => {
    const pt = parentTask(sub.taskId);
    return (
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {sub.taskId ? (
            <button
              onClick={() => openDrawer(sub.taskId!)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--c-blue-600)', fontWeight: 500, textAlign: 'left', minWidth: 0 }}
              title="Открыть задачу"
            >
              <SidebarIcon name="arrowRight" size={11} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pt?.title ?? sub.taskId.slice(0, 8)}
              </span>
            </button>
          ) : (
            <span />
          )}
          <StatusPill status={sub.status} />
        </div>

        {}
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-gray-800)', lineHeight: 1.4 }}>
          {sub.title}
        </div>

        {}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pt?.priority && <PriorityBadge priority={pt.priority} />}
          {sub.deadline && <Deadline date={sub.deadline} compact />}
        </div>

        {}
        <div style={{ display: 'flex', gap: 6, paddingTop: 2, borderTop: '1px solid var(--border-subtle)' }}>
          {sub.status === 'todo' && (
            <button className="btn btn--primary btn--sm" disabled={statusM.isPending} onClick={() => setStatus(sub, 'inprog')}>
              <SidebarIcon name="zap" size={12} /> Начать
            </button>
          )}
          {sub.status === 'inprog' && (
            <button className="btn btn--secondary btn--sm" disabled={statusM.isPending} onClick={() => setStatus(sub, 'blocked')} title="Я заблокирован — жду внешнего действия">
              <SidebarIcon name="alertTri" size={12} /> Заблокировано
            </button>
          )}
          {sub.status === 'blocked' && (
            <button className="btn btn--secondary btn--sm" disabled={statusM.isPending} onClick={() => setStatus(sub, 'inprog')}>
              <SidebarIcon name="zap" size={12} /> Возобновить
            </button>
          )}
          {sub.status === 'done' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--c-success)', fontWeight: 500 }}>
              <SidebarIcon name="checkCircle" size={13} /> Подтверждено тимлидом
            </span>
          )}
        </div>

        <Attachments kind="subtask" id={sub.id} canDelete collapsible compact />
      </div>
    );
  };


  const KanbanCard: React.FC<{ sub: Subtask }> = ({ sub }) => {
    const pt = parentTask(sub.taskId);
    return (
      <div
        className={`kcard${draggingId === sub.id ? ' is-dragging' : ''}`}
        draggable={sub.status !== 'done'}
        onDragStart={onDragStart(sub.id)}
        onDragEnd={onDragEnd}
        onClick={() => sub.taskId && openDrawer(sub.taskId)}
        style={{ cursor: sub.taskId ? 'pointer' : 'grab' }}
      >
        <p className="kcard__title">{sub.title}</p>
        {pt && (
          <div style={{ fontSize: 11, color: 'var(--c-gray-500)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <SidebarIcon name="layers" size={10} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt.title}</span>
          </div>
        )}
        {pt?.priority && (
          <div style={{ marginTop: 6 }}><PriorityBadge priority={pt.priority} /></div>
        )}

        {}
        <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
          {sub.status === 'todo' && (
            <button className="btn btn--primary btn--sm" style={{ width: '100%', justifyContent: 'center', gap: 4 }} disabled={statusM.isPending} onClick={() => setStatus(sub, 'inprog')}>
              <SidebarIcon name="zap" size={11} /> Начать
            </button>
          )}
          {sub.status === 'inprog' && (
            <button
              className="btn btn--secondary btn--sm"
              style={{ width: '100%', justifyContent: 'center', gap: 4 }}
              disabled={statusM.isPending}
              onClick={() => setStatus(sub, 'blocked')}
              title="Я заблокирован — жду внешнего действия"
            >
              <SidebarIcon name="alertTri" size={11} /> Заблокировано
            </button>
          )}
          {sub.status === 'blocked' && (
            <button className="btn btn--secondary btn--sm" style={{ width: '100%', justifyContent: 'center', gap: 4 }} disabled={statusM.isPending} onClick={() => setStatus(sub, 'inprog')}>
              <SidebarIcon name="zap" size={11} /> Возобновить
            </button>
          )}
          {sub.status === 'done' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, color: 'var(--c-success)', fontWeight: 500, padding: '4px 0' }}>
              <SidebarIcon name="checkCircle" size={11} /> Подтверждено тимлидом
            </div>
          )}
        </div>

        <div className="kcard__foot">
          <span style={{ fontSize: 10, color: 'var(--c-gray-400)' }}>{sub.id.slice(0, 8)}</span>
          {sub.deadline && <Deadline date={sub.deadline} compact />}
        </div>
      </div>
    );
  };


  return (
    <div>
      {}
      <div className="page-header">
        <div>
          <h1 className="page-title">Мои подзадачи</h1>
          <p className="page-sub">{userName} — личные подзадачи</p>
        </div>
        <div className="page-header__actions" style={{ gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--c-gray-600)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showDone}
              onChange={e => setShowDone(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Показать выполненные
          </label>
          <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              className={`btn btn--sm ${view === 'list' ? 'btn--primary' : 'btn--ghost'}`}
              style={{ borderRadius: 0, border: 'none', gap: 5 }}
              onClick={() => setView('list')}
            >
              <SidebarIcon name="list" size={14} /> Список
            </button>
            <button
              className={`btn btn--sm ${view === 'kanban' ? 'btn--primary' : 'btn--ghost'}`}
              style={{ borderRadius: 0, border: 'none', gap: 5 }}
              onClick={() => setView('kanban')}
            >
              <SidebarIcon name="kanban" size={14} /> Канбан
            </button>
          </div>
        </div>
      </div>

      {}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <Stat label="Активных" value={activeCount} />
        <Stat label="Заблокировано" value={blockedCount} alert={blockedCount > 0} />
        <Stat label="Просрочено" value={overdueCount} alert={overdueCount > 0} />
        <Stat label="Выполнено" value={doneCount} />
      </div>

      {}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 24, background: 'var(--c-blue-50)', border: '1px solid var(--c-blue-100, #DBEAFE)', borderRadius: 10, fontSize: 12.5, color: 'var(--c-blue-700, #1D4ED8)' }}>
        <SidebarIcon name="alert" size={15} />
        <span>Завершайте работу и переводите подзадачу в нужный статус. Отметку «Выполнено» ставит тимлид после проверки.</span>
      </div>

      {}
      {subtasksQ.isLoading && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>Загрузка…</div>
      )}
      {subtasksQ.isError && (
        <div style={{ padding: 24, textAlign: 'center', color: '#DC2626', fontSize: 13 }}>
          Ошибка загрузки: {(subtasksQ.error as Error).message}
        </div>
      )}

      {}
      {!subtasksQ.isLoading && !subtasksQ.isError && view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {STATUS_CONFIG.filter(cfg => showDone || cfg.status !== 'done').map(({ status, label, color }) => {
            const items = visibleSubtasks.filter(s => s.status === status);
            return (
              <div key={status}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-gray-800)' }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--c-gray-100)', color: 'var(--c-gray-600)', padding: '1px 8px', borderRadius: 999 }}>
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <div style={{ padding: 20, border: '1px dashed var(--border-subtle)', borderRadius: 10, textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>
                    Нет подзадач
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                    {items.map(sub => <SubtaskCard key={sub.id} sub={sub} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {}
      {!subtasksQ.isLoading && !subtasksQ.isError && view === 'kanban' && (
        <div className="kanban" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {STATUS_CONFIG.map(cfg => {
            const colItems = visibleSubtasks.filter(s => s.status === cfg.status);
            const isTarget = dropTarget === cfg.status;
            return (
              <div
                key={cfg.status}
                className="kcol"
                onDragOver={onDragOver(cfg.status)}
                onDragLeave={onDragLeave}
                onDrop={onDrop(cfg.status)}
                style={isTarget ? { outline: '2px dashed var(--c-blue-600)', outlineOffset: -2 } : {}}
              >
                <div className="kcol__head">
                  <span className="kcol__title">
                    <span className={`kcol__dot ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                  <span className="kcol__count">{colItems.length}</span>
                </div>
                <div className="kcol__drop">
                  {colItems.map(sub => <KanbanCard key={sub.id} sub={sub} />)}
                  {colItems.length === 0 && (
                    <div style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, color: 'var(--c-gray-400)' }}>
                      Перетащите сюда
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
