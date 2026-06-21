import React from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Task } from '../../types';
import { PriorityBadge, ServiceTag, Deadline, ReasonModal, Stat } from '../../components';
import { SidebarIcon } from '../../shells';
import { ruDate } from '../../utils/helpers';
import { useAppStore } from '../../store/appStore';
import { approveTask, rejectTask } from '../../api';

interface Props {
  tasks: Task[];
  openDrawer: (id: string) => void;
  setTasks: (fn: (prev: Task[]) => Task[]) => void;
}

export const ManagerReviewScreen: React.FC<Props> = ({ tasks, openDrawer, setTasks }) => {
  const setToast = useAppStore(s => s.setToast);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [rejectId, setRejectId] = React.useState<string | null>(null);

  const reviewTasks = React.useMemo(
    () => tasks
      .filter(t => t.status === 'review')
      .sort((a, b) => {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const pa = order[a.priority] ?? 9;
        const pb = order[b.priority] ?? 9;
        if (pa !== pb) return pa - pb;
        return (a.deadline || '').localeCompare(b.deadline || '');
      }),
    [tasks],
  );

  // Tasks whose deadline already passed but still sit in review.
  const overdueCount = reviewTasks.filter(t => {
    if (!t.deadline) return false;
    return new Date(t.deadline + 'T23:59:59') < new Date();
  }).length;
  const criticalCount = reviewTasks.filter(t => t.priority === 'critical' || t.priority === 'high').length;

  const approveM = useMutation({
    mutationFn: (id: string) => approveTask(id),
    onMutate: (id) => setBusyId(id),
    onSuccess: (t, id) => {
      setTasks(prev => prev.map(x => (x.id === id ? { ...x, status: t.status } : x)));
      setToast({ kind: 'success', msg: 'Задача принята' });
    },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
    onSettled: () => setBusyId(null),
  });

  const rejectM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectTask(id, reason),
    onMutate: ({ id }) => setBusyId(id),
    onSuccess: (t, { id, reason }) => {
      setTasks(prev => prev.map(x => (x.id === id ? { ...x, status: t.status, rejectReason: reason } : x)));
      setRejectId(null);
      setToast({ kind: 'info', msg: 'Задача возвращена на доработку' });
    },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
    onSettled: () => setBusyId(null),
  });

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Задачи на проверке</h1>
          <p className="page-sub">Задачи, отправленные командами и ожидающие вашего решения</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <Stat
          label="Ожидают проверки"
          value={reviewTasks.length}
          icon={<SidebarIcon name="eye" size={16} />}
          iconBg={reviewTasks.length > 0 ? '#F5F3FF' : '#F0FDF4'}
          iconColor={reviewTasks.length > 0 ? '#7C3AED' : '#059669'}
        />
        <Stat
          label="Высокий приоритет"
          value={criticalCount}
          alert={criticalCount > 0}
          icon={<SidebarIcon name="alertTri" size={16} />}
          iconBg={criticalCount > 0 ? '#FFFBEB' : '#F0FDF4'}
          iconColor={criticalCount > 0 ? '#D97706' : '#059669'}
        />
        <Stat
          label="Просрочено"
          value={overdueCount}
          alert={overdueCount > 0}
          icon={<SidebarIcon name="alert" size={16} />}
          iconBg={overdueCount > 0 ? '#FEF2F2' : '#F0FDF4'}
          iconColor={overdueCount > 0 ? '#DC2626' : '#059669'}
        />
      </div>

      {/* Empty state */}
      {reviewTasks.length === 0 ? (
        <div className="card">
          <div style={{ padding: '56px 0', textAlign: 'center', color: 'var(--c-gray-400)' }}>
            <SidebarIcon name="checkCircle" size={40} />
            <div style={{ marginTop: 12, fontSize: 15, fontWeight: 500, color: 'var(--c-gray-600)' }}>Очередь проверки пуста</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>Все задачи проверены — новых на проверке нет</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviewTasks.map(task => {
            const totalSubs = task.subtasks.length;
            const doneSubs = task.subtasks.filter(s => s.status === 'done').length;
            const isBusy = busyId === task.id;
            return (
              <div
                key={task.id}
                className="card"
                style={{ cursor: 'pointer', transition: 'box-shadow .15s' }}
                onClick={() => openDrawer(task.id)}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--sh-md)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
              >
                <div style={{ padding: 16, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {/* Left: task info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-gray-900)' }}>{task.title}</span>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--c-gray-600)', lineHeight: 1.5, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {task.desc || '—'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--c-gray-500)' }}>
                      <span className="mono">{task.id}</span>
                      <ServiceTag id={task.service} />
                      {task.team && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <SidebarIcon name="team" size={12} /> {task.team}
                        </span>
                      )}
                      <Deadline date={task.deadline} compact />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <SidebarIcon name="clock" size={12} /> {ruDate(task.created)}
                      </span>
                      {totalSubs > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: doneSubs === totalSubs ? 'var(--c-success)' : 'var(--c-gray-500)' }}>
                          <SidebarIcon name="layers" size={12} /> Подзадачи {doneSubs}/{totalSubs}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: review actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button
                      className="btn btn--primary btn--sm"
                      style={{ justifyContent: 'center', gap: 5, background: 'var(--c-success)', borderColor: 'var(--c-success)' }}
                      disabled={isBusy}
                      onClick={() => approveM.mutate(task.id)}
                    >
                      <SidebarIcon name="check" size={13} /> Принять
                    </button>
                    <button
                      className="btn btn--outline btn--sm"
                      style={{ justifyContent: 'center', color: '#DC2626', borderColor: '#DC2626' }}
                      disabled={isBusy}
                      onClick={() => setRejectId(task.id)}
                    >
                      Вернуть на доработку
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejectId && (
        <ReasonModal
          title="Вернуть задачу на доработку"
          placeholder="Что нужно доработать…"
          confirmLabel="Вернуть"
          busy={rejectM.isPending}
          onConfirm={reason => rejectM.mutate({ id: rejectId, reason })}
          onClose={() => setRejectId(null)}
        />
      )}
    </div>
  );
};
