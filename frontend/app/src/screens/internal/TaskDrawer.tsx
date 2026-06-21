import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, TaskStatus, SubtaskStatus, Priority } from '../../types';
import { STATUSES } from '../../data/mock';
import { StatusPill, PriorityBadge, ServiceTag, Deadline, ReasonModal } from '../../components';
import { SidebarIcon } from '../../shells';
import { useAppStore } from '../../store/appStore';
import { useAutosave } from '../../hooks/useAutosave';
import {
  getTask, getTaskComments,
  addTaskComment as apiAddTaskComment,
  updateTaskStatus as apiUpdateTaskStatus,
  updateSubtask, updateTask, deleteTask as apiDeleteTask,
  archiveTask as apiArchiveTask, approveTask, rejectTask,
  getTeams, assignTask,
  getTaskFiles, uploadTaskFile, deleteTaskFile,
} from '../../api';
import type { FileAttachment } from '../../api';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч. назад`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} д. назад`;
  return new Date(iso).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('').slice(0, 2) || '?';

const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 24 }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: '50%', background: '#6366F1', color: '#fff', fontSize: size * 0.4, fontWeight: 600, flexShrink: 0 }}>
    {initials(name)}
  </span>
);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

// File attachments for a task. Self-contained: owns its query/mutations.
const TaskFiles: React.FC<{ taskId: string; canDelete: boolean }> = ({ taskId, canDelete }) => {
  const qc = useQueryClient();
  const setToast = useAppStore(s => s.setToast);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const filesQ = useQuery<FileAttachment[]>({
    queryKey: ['task-files', taskId],
    queryFn: () => getTaskFiles(taskId),
    staleTime: 30_000,
  });

  const uploadM = useMutation({
    mutationFn: (file: File) => uploadTaskFile(taskId, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-files', taskId] }); setToast({ kind: 'success', msg: 'Файл загружен' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message || 'Ошибка загрузки' }),
  });

  const deleteM = useMutation({
    mutationFn: (fileId: string) => deleteTaskFile(taskId, fileId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-files', taskId] }); setToast({ kind: 'success', msg: 'Файл удалён' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message || 'Ошибка удаления' }),
  });

  const files = filesQ.data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {filesQ.isLoading ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--c-gray-400)', fontSize: 13 }}>Загрузка…</div>
      ) : files.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--c-gray-400)', fontSize: 13 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📎</div>Файлов пока нет
        </div>
      ) : files.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: '#fff' }}>
          <SidebarIcon name="fileText" size={14} />
          <a
            href={`/api/tasks/${taskId}/files/${f.id}/download`}
            target="_blank"
            rel="noreferrer"
            style={{ flex: 1, fontSize: 13, color: 'var(--c-blue-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}
            title={f.filename}
          >
            {f.filename}
          </a>
          <span style={{ fontSize: 11, color: 'var(--c-gray-400)', flexShrink: 0 }}>{formatSize(f.sizeBytes)}</span>
          {canDelete && (
            <button
              className="iconbtn"
              style={{ color: 'var(--c-gray-400)', padding: 2, flexShrink: 0 }}
              disabled={deleteM.isPending}
              onClick={() => deleteM.mutate(f.id)}
              title="Удалить файл"
            >
              <SidebarIcon name="x" size={13} />
            </button>
          )}
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) { uploadM.mutate(f); e.target.value = ''; }
          }}
        />
        <button
          className="btn btn--outline btn--sm"
          style={{ gap: 6 }}
          disabled={uploadM.isPending}
          onClick={() => fileRef.current?.click()}
        >
          <SidebarIcon name="upload" size={13} />
          {uploadM.isPending ? 'Загрузка…' : 'Прикрепить файл'}
        </button>
      </div>
    </div>
  );
};

interface Props {
  taskId: string;
  onClose: () => void;
  tasks: Task[];
  setTasks: (fn: (prev: Task[]) => Task[]) => void;
}

// 'reject' is intentionally omitted — rejection requires a reason via ReasonModal.
const TASK_STATUSES: TaskStatus[] = ['draft', 'assigned', 'inprog', 'review', 'done', 'archive'];

export const TaskDrawer: React.FC<Props> = ({ taskId, onClose, tasks, setTasks }) => {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<'subtasks' | 'comments' | 'files'>('subtasks');
  const [commentText, setCommentText] = React.useState('');
  const [visibleToClient, setVisibleToClient] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');
  const [editPriority, setEditPriority] = React.useState<Priority>('medium');
  const [editDeadline, setEditDeadline] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [showReject, setShowReject] = React.useState(false);

  const setToast = useAppStore(s => s.setToast);
  const role = useAppStore(s => s.role);

  const detailQ = useQuery({ queryKey: ['task', taskId], queryFn: () => getTask(taskId), retry: false });
  const commentsQ = useQuery({ queryKey: ['task-comments', taskId], queryFn: () => getTaskComments(taskId) });

  // Prefer freshly fetched detail (has subtasks); fall back to the store task.
  const storeTask = tasks.find(t => t.id === taskId);
  const task = detailQ.data ?? storeTask;

  const syncStore = (status: TaskStatus) => setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status } : t)));
  const refreshDetail = () => qc.invalidateQueries({ queryKey: ['task', taskId] });

  const statusM = useMutation({
    mutationFn: (status: TaskStatus) => apiUpdateTaskStatus(taskId, status),
    onSuccess: (_d, status) => { syncStore(status); refreshDetail(); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const approveM = useMutation({
    mutationFn: () => approveTask(taskId),
    onSuccess: (t) => { syncStore(t.status); refreshDetail(); setToast({ kind: 'success', msg: 'Задача принята' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const rejectM = useMutation({
    mutationFn: (reason: string) => rejectTask(taskId, reason),
    onSuccess: (t, reason) => {
      setTasks(prev => prev.map(x => (x.id === taskId ? { ...x, status: t.status, rejectReason: reason } : x)));
      refreshDetail(); setShowReject(false); setToast({ kind: 'info', msg: 'Задача возвращена на доработку' });
    },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const subtaskM = useMutation({
    mutationFn: ({ id, done, prevStatus }: { id: string; done: boolean; prevStatus: SubtaskStatus }) =>
      updateSubtask(taskId, id, { status: done ? 'done' : (prevStatus === 'done' ? 'todo' : prevStatus) }),
    onSuccess: refreshDetail,
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const commentM = useMutation({
    mutationFn: () => apiAddTaskComment(taskId, { text: commentText.trim(), visibleToClient }),
    onSuccess: () => { setCommentText(''); qc.invalidateQueries({ queryKey: ['task-comments', taskId] }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  // Autosaved edit form — changes persist on a debounce, no explicit Save click.
  const saveEdit = React.useCallback(async () => {
    if (!editTitle.trim()) return;
    const t = await updateTask(taskId, {
      title: editTitle.trim(), desc: editDesc.trim(), priority: editPriority, deadline: editDeadline,
    });
    setTasks(prev => prev.map(x => (x.id === taskId
      ? { ...x, title: t.title, desc: t.desc, priority: t.priority, deadline: t.deadline }
      : x)));
  }, [taskId, editTitle, editDesc, editPriority, editDeadline, setTasks]);

  const editAutosave = useAutosave(saveEdit);

  const finishEdit = async () => {
    await editAutosave.flush().catch(() => { /* indicator already reflects error */ });
    refreshDetail();
    setEditing(false);
  };

  const deleteM = useMutation({
    mutationFn: () => apiDeleteTask(taskId),
    onSuccess: () => { setTasks(prev => prev.filter(t => t.id !== taskId)); onClose(); setToast({ kind: 'info', msg: 'Задача удалена' }); },
    onError: (e: Error) => { setConfirmDelete(false); setToast({ kind: 'error', msg: e.message }); },
  });

  const archiveM = useMutation({
    mutationFn: () => apiArchiveTask(taskId),
    onSuccess: () => { syncStore('archive'); onClose(); setToast({ kind: 'info', msg: 'Задача архивирована' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  // Team assignment for draft / returned tasks — the canonical draft → assigned
  // path (also re-routes a rejected task to a team), so drafts never get stuck.
  const isManagerRole = role === 'manager' || role === 'admin';
  const teamsQ = useQuery({ queryKey: ['teams'], queryFn: () => getTeams(), enabled: isManagerRole });
  const [assignTeamId, setAssignTeamId] = React.useState('');
  const assignM = useMutation({
    mutationFn: (teamId: string) => assignTask(taskId, teamId),
    onSuccess: (t) => {
      setTasks(prev => prev.map(x => (x.id === taskId ? { ...x, status: t.status, team: t.team } : x)));
      refreshDetail();
      setToast({ kind: 'success', msg: 'Задача назначена команде' });
    },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  if (!task) return null;

  const subtasks = task.subtasks ?? [];
  const doneSubs = subtasks.filter(s => s.status === 'done').length;
  const totalSubs = subtasks.length;
  const pct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;

  const startEdit = () => { setEditTitle(task.title); setEditDesc(task.desc); setEditPriority(task.priority); setEditDeadline(task.deadline ?? ''); setEditing(true); };
  const comments = commentsQ.data ?? [];
  const canManage = role === 'manager' || role === 'admin';

  return (
    <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer">
        {/* Head */}
        <div className="drawer__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <StatusPill status={task.status} />
            <span className="mono" style={{ color: 'var(--c-gray-500)', fontSize: 12 }}>{task.id.slice(0, 8)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {!editing && canManage && task.status !== 'done' && task.status !== 'archive' && (
              <button className="iconbtn" title="Редактировать" onClick={startEdit}><SidebarIcon name="edit" size={15} /></button>
            )}
            {canManage && (
              <button className="iconbtn" title="Удалить" onClick={() => setConfirmDelete(true)} style={{ color: '#DC2626' }}><SidebarIcon name="trash" size={15} /></button>
            )}
            <button className="iconbtn" onClick={onClose} title="Закрыть"><SidebarIcon name="x" size={15} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="drawer__body">
          {editing ? (
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="input" value={editTitle} onChange={e => { setEditTitle(e.target.value); editAutosave.trigger(); }} style={{ fontSize: 18, fontWeight: 600, padding: '8px 12px', border: '1px solid var(--c-blue-400)', borderRadius: 8, width: '100%', boxSizing: 'border-box' }} autoFocus />
              <textarea className="input" value={editDesc} onChange={e => { setEditDesc(e.target.value); editAutosave.trigger(); }} rows={4} style={{ fontSize: 14, padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--c-gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>Приоритет</label>
                  <select className="select" value={editPriority} onChange={e => { setEditPriority(e.target.value as Priority); editAutosave.trigger(); }}>
                    <option value="critical">Критичный</option>
                    <option value="high">Высокий</option>
                    <option value="medium">Средний</option>
                    <option value="low">Низкий</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--c-gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>Дедлайн</label>
                  <input type="date" className="input" value={editDeadline} onChange={e => { setEditDeadline(e.target.value); editAutosave.trigger(); }} style={{ padding: '6px 10px', borderRadius: 8, width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="btn btn--primary btn--sm" onClick={finishEdit}>Готово</button>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--c-gray-500)' }}>
                  {editAutosave.status === 'saving' && (<><SidebarIcon name="refresh" size={12} /> Сохранение…</>)}
                  {editAutosave.status === 'saved'  && (<><SidebarIcon name="checkCircle" size={12} /> Сохранено</>)}
                  {editAutosave.status === 'error'  && (<span style={{ color: '#DC2626' }}>Ошибка сохранения</span>)}
                  {editAutosave.status === 'idle'   && (<><SidebarIcon name="cloud" size={12} /> Изменения сохраняются автоматически</>)}
                </span>
              </div>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--c-gray-900)', margin: '0 0 10px', lineHeight: 1.3 }}>{task.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--c-gray-600)', lineHeight: 1.6, margin: '0 0 20px' }}>{task.desc || '—'}</p>
            </>
          )}

          {/* Rejection reason banner */}
          {task.status === 'reject' && task.rejectReason && (
            <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, marginBottom: 16 }}>
              <SidebarIcon name="alertTri" size={16} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#92400E', marginBottom: 3 }}>Задача возвращена на доработку</div>
                <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>{task.rejectReason}</div>
              </div>
            </div>
          )}

          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '14px 16px', background: 'var(--c-gray-50)', borderRadius: 10, border: '1px solid var(--border-subtle)', marginBottom: 24, fontSize: 13 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-gray-400)', textTransform: 'uppercase' }}>Сервис</span>
              <ServiceTag id={task.service} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-gray-400)', textTransform: 'uppercase' }}>Команда</span>
              <span style={{ color: 'var(--c-gray-700)', fontWeight: 500 }}>{task.team || '—'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-gray-400)', textTransform: 'uppercase' }}>Приоритет</span>
              <PriorityBadge priority={task.priority} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-gray-400)', textTransform: 'uppercase' }}>Дедлайн</span>
              <Deadline date={task.deadline} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-gray-400)', textTransform: 'uppercase' }}>Создал</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Avatar name={task.createdBy} size={20} />
                <span style={{ color: 'var(--c-gray-700)', fontWeight: 500 }}>{task.createdBy}</span>
              </div>
            </div>
          </div>

          {/* Assign to a team — closes the draft/returned dead-end */}
          {isManagerRole && (task.status === 'draft' || task.status === 'reject') && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 20, padding: '12px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#1D4ED8', textTransform: 'uppercase', marginBottom: 5 }}>
                  {task.status === 'draft' ? 'Назначить команду' : 'Переназначить команду'}
                </label>
                <select className="select" value={assignTeamId} onChange={e => setAssignTeamId(e.target.value)} disabled={teamsQ.isLoading || assignM.isPending} style={{ width: '100%' }}>
                  <option value="">{teamsQ.isLoading ? 'Загрузка…' : 'Выберите команду…'}</option>
                  {(teamsQ.data ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <button className="btn btn--primary btn--sm" disabled={!assignTeamId || assignM.isPending} onClick={() => assignM.mutate(assignTeamId)}>
                <SidebarIcon name="send" size={13} /> Назначить
              </button>
            </div>
          )}

          {/* Manager review actions */}
          {canManage && task.status === 'review' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button className="btn btn--primary btn--sm" disabled={approveM.isPending} onClick={() => approveM.mutate()} style={{ background: 'var(--c-success)', borderColor: 'var(--c-success)' }}>
                <SidebarIcon name="check" size={13} /> Принять
              </button>
              <button className="btn btn--outline btn--sm" disabled={rejectM.isPending} onClick={() => setShowReject(true)} style={{ color: '#DC2626', borderColor: '#DC2626' }}>
                Вернуть на доработку
              </button>
            </div>
          )}

          {/* Manager-only: reopen a completed / archived task back into work */}
          {canManage && (task.status === 'done' || task.status === 'archive') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 14px', background: 'var(--c-gray-50)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
              <SidebarIcon name="checkCircle" size={16} />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--c-gray-600)' }}>
                {task.status === 'archive' ? 'Задача в архиве' : 'Задача выполнена и принята'}
              </span>
              <button className="btn btn--outline btn--sm" disabled={statusM.isPending} onClick={() => statusM.mutate('inprog')} style={{ gap: 5 }}>
                <SidebarIcon name="refresh" size={13} /> Вернуть в работу
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs">
            <button className={`tabs__item${tab === 'subtasks' ? ' active' : ''}`} onClick={() => setTab('subtasks')}>
              Подзадачи {totalSubs > 0 && <span style={{ marginLeft: 4, fontSize: 11, background: 'var(--c-gray-200)', borderRadius: 999, padding: '0 6px' }}>{totalSubs}</span>}
            </button>
            <button className={`tabs__item${tab === 'comments' ? ' active' : ''}`} onClick={() => setTab('comments')}>
              Комментарии {comments.length > 0 && <span style={{ marginLeft: 4, fontSize: 11, background: 'var(--c-gray-200)', borderRadius: 999, padding: '0 6px' }}>{comments.length}</span>}
            </button>
            <button className={`tabs__item${tab === 'files' ? ' active' : ''}`} onClick={() => setTab('files')}>
              Файлы
            </button>
          </div>

          {/* Subtasks */}
          {tab === 'subtasks' && (
            <div>
              {totalSubs > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--c-gray-500)', marginBottom: 6 }}>
                    <span>Выполнено: {doneSubs} из {totalSubs}</span><span>{pct}%</span>
                  </div>
                  <div className="progress" style={{ height: 6 }}><div className="progress__fill" style={{ width: `${pct}%` }} /></div>
                  {task.status === 'inprog' && doneSubs === totalSubs && totalSubs > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8 }}>
                      <SidebarIcon name="checkCircle" size={16} />
                      <span style={{ flex: 1, fontSize: 13, color: '#166534', fontWeight: 500 }}>Все подзадачи выполнены — готово к отправке на проверку</span>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {detailQ.isLoading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--c-gray-400)', fontSize: 13 }}>Загрузка…</div>}
                {subtasks.map(sub => {
                  const isDone = sub.status === 'done';
                  return (
                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: isDone ? 'var(--c-gray-50)' : '#fff' }}>
                      <input type="checkbox" checked={isDone} disabled={!canManage || subtaskM.isPending} onChange={() => subtaskM.mutate({ id: sub.id, done: !isDone, prevStatus: sub.status })} style={{ cursor: canManage ? 'pointer' : 'default', width: 16, height: 16, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: isDone ? 'var(--c-gray-400)' : 'var(--c-gray-800)', textDecoration: isDone ? 'line-through' : 'none' }}>{sub.title}</span>
                      {sub.workerName && <span style={{ fontSize: 11, color: 'var(--c-gray-500)' }}>{sub.workerName.split(' ')[0]}</span>}
                      {sub.deadline && <Deadline date={sub.deadline} compact />}
                      <StatusPill status={sub.status} />
                    </div>
                  );
                })}
                {!detailQ.isLoading && totalSubs === 0 && (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--c-gray-400)', fontSize: 13 }}>Нет подзадач</div>
                )}
              </div>
            </div>
          )}

          {/* Comments */}
          {tab === 'comments' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                {comments.map((c, i) => (
                  <div key={c.id ?? i} style={{ display: 'flex', gap: 10 }}>
                    <Avatar name={c.author} size={24} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-gray-800)' }}>{c.author}</span>
                        <span style={{ fontSize: 11, color: 'var(--c-gray-400)' }}>{relativeTime(c.date)}</span>
                        {c.visibleToClient && <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--c-info-light)', color: 'var(--c-info)', padding: '1px 6px', borderRadius: 999 }}>видно клиенту</span>}
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--c-gray-700)', lineHeight: 1.6, margin: 0, background: 'var(--c-gray-50)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--border-subtle)' }}>{c.text}</p>
                    </div>
                  </div>
                ))}
                {!commentsQ.isLoading && comments.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--c-gray-400)', fontSize: 13 }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>Комментариев пока нет
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea className="textarea" placeholder="Написать комментарий..." value={commentText} onChange={e => setCommentText(e.target.value)} rows={3} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--c-gray-600)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={visibleToClient} onChange={e => setVisibleToClient(e.target.checked)} />
                    Видно клиенту
                  </label>
                  <button className="btn btn--primary btn--sm" onClick={() => commentM.mutate()} disabled={commentM.isPending || !commentText.trim()}>
                    <SidebarIcon name="send" size={13} /> Отправить
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Files */}
          {tab === 'files' && (
            <TaskFiles taskId={taskId} canDelete={canManage} />
          )}
        </div>

        {/* Return-to-rework reason */}
        {showReject && (
          <ReasonModal
            title="Вернуть задачу на доработку"
            placeholder="Что нужно доработать…"
            confirmLabel="Вернуть"
            busy={rejectM.isPending}
            onConfirm={reason => rejectM.mutate(reason)}
            onClose={() => setShowReject(false)}
          />
        )}

        {/* Confirm delete */}
        {confirmDelete && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 24, width: 300, boxShadow: 'var(--sh-lg)' }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--c-gray-900)', marginBottom: 8 }}>Удалить задачу?</div>
              <div style={{ fontSize: 13, color: 'var(--c-gray-600)', marginBottom: 20, lineHeight: 1.5 }}>Задача будет безвозвратно удалена.</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn--outline btn--sm" onClick={() => setConfirmDelete(false)}>Отмена</button>
                <button className="btn btn--sm" style={{ background: '#DC2626', color: '#fff', border: 'none' }} disabled={deleteM.isPending} onClick={() => deleteM.mutate()}>Удалить</button>
              </div>
            </div>
          </div>
        )}

        {/* Footer: status control */}
        <div className="drawer__foot">
          <select className="select" style={{ flex: 1 }} value={task.status} onChange={e => statusM.mutate(e.target.value as TaskStatus)} disabled={statusM.isPending || !canManage}>
            {TASK_STATUSES.map(s => <option key={s} value={s} disabled={s === 'assigned' && !task.team}>{STATUSES[s]?.label}</option>)}
          </select>
          {canManage && (
            <button className="btn btn--ghost btn--sm" style={{ color: 'var(--c-gray-500)' }} disabled={archiveM.isPending} onClick={() => archiveM.mutate()}>
              <SidebarIcon name="archive" size={13} /> Архив
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
