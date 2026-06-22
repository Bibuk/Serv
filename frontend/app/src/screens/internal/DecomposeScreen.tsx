import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, SubtaskStatus } from '../../types';
import { StatusPill, Deadline, Attachments } from '../../components';
import { SidebarIcon } from '../../shells';
import { useAppStore } from '../../store/appStore';
import { useMyTeam } from '../../hooks/useTeam';
import {
  getTask, createSubtask, updateSubtask, deleteSubtask,
  acceptTask, submitTaskReview,
} from '../../api';
import type { UpdateSubtaskDto } from '../../api';

interface Props {
  taskId: string;
  tasks: Task[];
  openDrawer: (id: string) => void;
}

interface NewSubtaskForm { title: string; desc: string; worker: string; deadline: string }
const emptyForm: NewSubtaskForm = { title: '', desc: '', worker: '', deadline: '' };

export const DecomposeScreen: React.FC<Props> = ({ taskId, tasks, openDrawer }) => {
  const qc = useQueryClient();
  const setScreen = useAppStore(s => s.setScreen);
  const setTasks = useAppStore(s => s.setTasks);
  const setToast = useAppStore(s => s.setToast);
  const { teamName, members } = useMyTeam();

  const [form, setForm] = React.useState<NewSubtaskForm>(emptyForm);
  const [addError, setAddError] = React.useState('');

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<NewSubtaskForm>(emptyForm);
  const [statusFilter, setStatusFilter] = React.useState<'all' | SubtaskStatus>('all');

  const taskQ = useQuery({ queryKey: ['task', taskId], queryFn: () => getTask(taskId), enabled: !!taskId, retry: false });
  const task = taskQ.data;
  const memberName = (sub: { worker: string; workerName?: string }) =>
    sub.workerName ?? members.find(m => m.id === sub.worker)?.name ?? '';

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['task', taskId] });
    if (task) setTasks(prev => prev.map(t => (t.id === task.id ? { ...t } : t)));
  };

  const addM = useMutation({
    mutationFn: () => createSubtask(taskId, { title: form.title.trim(), workerId: form.worker, deadline: form.deadline || undefined }),
    onSuccess: () => { invalidate(); setForm(emptyForm); setToast({ kind: 'success', msg: 'Подзадача добавлена' }); },
    onError: (e: Error) => setAddError(e.message || 'Не удалось добавить подзадачу'),
  });

  const toggleM = useMutation({
    mutationFn: ({ id, done, prevStatus }: { id: string; done: boolean; prevStatus: SubtaskStatus }) =>
      updateSubtask(taskId, id, { status: done ? 'done' : (prevStatus === 'done' ? 'todo' : prevStatus) }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message || 'Не удалось обновить подзадачу' }),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteSubtask(taskId, id),
    onSuccess: () => { invalidate(); setToast({ kind: 'success', msg: 'Подзадача удалена' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const editM = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateSubtaskDto }) => updateSubtask(taskId, id, dto),
    onSuccess: () => { invalidate(); setEditingId(null); setToast({ kind: 'success', msg: 'Подзадача обновлена' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message || 'Не удалось обновить подзадачу' }),
  });

  const startEdit = (sub: { id: string; title: string; worker: string; deadline: string }) => {
    setEditingId(sub.id);
    setEditForm({ title: sub.title, desc: '', worker: sub.worker, deadline: sub.deadline ?? '' });
  };

  const saveEdit = (id: string) => {
    const dto: UpdateSubtaskDto = {};
    if (editForm.title.trim()) dto.title = editForm.title.trim();
    if (editForm.worker) dto.workerId = editForm.worker;
    dto.deadline = editForm.deadline || undefined;
    editM.mutate({ id, dto });
  };

  const actionM = useMutation({
    mutationFn: (kind: 'accept' | 'submit') => (kind === 'accept' ? acceptTask(taskId) : submitTaskReview(taskId)),
    onSuccess: (updated, kind) => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: updated.status } : t)));
      setToast({ kind: 'success', msg: kind === 'accept' ? 'Задача принята в работу' : 'Задача отправлена на проверку' });
    },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message || 'Действие не выполнено' }),
  });

  const handleAdd = () => {
    const title = form.title.trim();
    if (!title) { setAddError('Введите название подзадачи'); return; }
    if (title.length > 200) { setAddError('Название не должно превышать 200 символов'); return; }
    if (form.deadline && form.deadline < new Date().toISOString().split('T')[0]) {
      setAddError('Дедлайн не может быть в прошлом'); return;
    }
    setAddError('');
    addM.mutate();
  };

  if (taskQ.isError || (!taskQ.isLoading && !task)) {
    const teamTasks = tasks.filter(t => t.team === teamName);
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Декомпозиция</h1>
            <p className="page-sub">Выберите задачу для разбиения на подзадачи</p>
          </div>
        </div>
        <div className="card">
          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {teamTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--c-gray-400)', fontSize: 13 }}>Нет задач команды</div>
            ) : teamTasks.map(t => (
              <button
                key={t.id}
                className="btn btn--ghost"
                style={{ justifyContent: 'space-between', width: '100%' }}
                onClick={() => setScreen('decompose', { taskId: t.id })}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="mono">{t.id}</span>
                  <span style={{ fontWeight: 500 }}>{t.title}</span>
                </span>
                <StatusPill status={t.status} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (taskQ.isLoading || !task) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>Загрузка задачи…</div>;
  }

  const subtasks = task.subtasks;
  const doneSubs = subtasks.filter(s => s.status === 'done').length;
  const totalSubs = subtasks.length;
  const pct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;
  const blockedSubs = subtasks.filter(s => s.status === 'blocked').length;

  // Surface work that needs the lead's attention first (blocked → to-do →
  // in progress) and sink confirmed (done) subtasks to the bottom.
  const SUBTASK_ORDER: Record<SubtaskStatus, number> = { blocked: 0, todo: 1, inprog: 2, done: 3 };
  const statusCounts: Record<SubtaskStatus, number> = {
    todo: subtasks.filter(s => s.status === 'todo').length,
    inprog: subtasks.filter(s => s.status === 'inprog').length,
    blocked: blockedSubs,
    done: doneSubs,
  };
  const FILTER_CHIPS: { id: 'all' | SubtaskStatus; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'todo', label: 'К выполнению' },
    { id: 'inprog', label: 'В работе' },
    { id: 'blocked', label: 'Заблокировано' },
    { id: 'done', label: 'Выполнено' },
  ];
  const visibleSubtasks = subtasks
    .filter(s => statusFilter === 'all' || s.status === statusFilter)
    .slice()
    .sort((a, b) => SUBTASK_ORDER[a.status] - SUBTASK_ORDER[b.status]);

  return (
    <div>
      {}
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn--ghost btn--sm" onClick={() => openDrawer(task.id)} style={{ color: 'var(--c-blue-600)', paddingLeft: 0 }}>
          <SidebarIcon name="arrowLeft" size={14} />
          К задаче {task.id}
        </button>
      </div>

      {}
      <div className="page-header">
        <div>
          <h1 className="page-title">Декомпозиция</h1>
          <p className="page-sub" style={{ fontSize: 14, color: 'var(--c-gray-700)', fontWeight: 500, marginTop: 2 }}>{task.title}</p>
        </div>
        <div className="page-header__actions" style={{ alignItems: 'center', gap: 10 }}>
          <StatusPill status={task.status} />
          {task.status === 'assigned' && (
            <button className="btn btn--primary btn--sm" disabled={actionM.isPending} onClick={() => actionM.mutate('accept')}>
              <SidebarIcon name="zap" size={13} />
              Принять в работу
            </button>
          )}
          {task.status === 'inprog' && (() => {
            const canSubmit = totalSubs === 0 || doneSubs === totalSubs;
            return (
              <button
                className="btn btn--primary btn--sm"
                disabled={actionM.isPending || !canSubmit}
                title={canSubmit ? 'Отправить на проверку менеджеру' : `Сначала закройте все подзадачи (${doneSubs}/${totalSubs})`}
                onClick={() => actionM.mutate('submit')}
              >
                <SidebarIcon name="check" size={13} />
                {canSubmit ? 'Отправить на проверку' : `Подзадачи ${doneSubs}/${totalSubs}`}
              </button>
            );
          })()}
        </div>
      </div>

      {}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-gray-800)' }}>{doneSubs} из {totalSubs} подзадач выполнено</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: pct === 100 ? 'var(--c-success)' : 'var(--c-blue-600)' }}>{pct}%</span>
          </div>
          <div className="progress" style={{ height: 8 }}>
            <div className="progress__fill" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--c-success)' : 'var(--c-blue-600)' }} />
          </div>
        </div>
      </div>

      {}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {}
        <div className="card">
          <div className="card__head" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span className="card__title">Подзадачи</span>
            {blockedSubs > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', padding: '2px 8px', borderRadius: 999 }}>
                <SidebarIcon name="alertTri" size={11} /> {blockedSubs} заблокировано
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--c-gray-100)', color: 'var(--c-gray-600)', padding: '2px 8px', borderRadius: 999 }}>{totalSubs}</span>
          </div>
          {totalSubs > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 12px' }}>
              {FILTER_CHIPS.map(chip => {
                const count = chip.id === 'all' ? totalSubs : statusCounts[chip.id];
                const active = statusFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setStatusFilter(chip.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                      fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 999,
                      border: active ? '1px solid var(--c-blue-500)' : '1px solid var(--border-subtle)',
                      background: active ? 'var(--c-blue-50)' : '#fff',
                      color: active ? 'var(--c-blue-700, #1D4ED8)' : 'var(--c-gray-600)',
                    }}
                  >
                    {chip.label}
                    <span style={{ fontSize: 10, fontWeight: 600, color: active ? 'var(--c-blue-600)' : 'var(--c-gray-400)' }}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subtasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--c-gray-400)', fontSize: 13 }}>
                Подзадачи не добавлены. Начните с добавления первой подзадачи.
              </div>
            )}
            {subtasks.length > 0 && visibleSubtasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--c-gray-400)', fontSize: 13 }}>
                Нет подзадач в выбранном статусе.
              </div>
            )}
            {visibleSubtasks.map(sub => {
              const isDone = sub.status === 'done';
              const isBlocked = sub.status === 'blocked';
              const name = memberName(sub);
              const isEditing = editingId === sub.id;

              if (isEditing) {
                return (
                  <div key={sub.id} style={{ padding: '12px', border: '2px solid var(--c-blue-400)', borderRadius: 8, background: 'var(--c-blue-50)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="input"
                        style={{ flex: 1 }}
                        value={editForm.title}
                        onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Название подзадачи"
                        autoFocus
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        className="select"
                        style={{ flex: 1 }}
                        value={editForm.worker}
                        onChange={e => setEditForm(f => ({ ...f, worker: e.target.value }))}
                      >
                        <option value="">Без исполнителя</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <input
                        className="input"
                        type="date"
                        style={{ width: 140 }}
                        value={editForm.deadline}
                        onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value }))}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn--primary btn--sm"
                        disabled={!editForm.title.trim() || editM.isPending}
                        onClick={() => saveEdit(sub.id)}
                      >
                        {editM.isPending ? 'Сохранение…' : 'Сохранить'}
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={() => setEditingId(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={sub.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderLeft: isBlocked ? '3px solid #7C3AED' : '1px solid var(--border-subtle)', borderRadius: 8, background: isDone ? 'var(--c-gray-50)' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={isDone}
                    disabled={toggleM.isPending}
                    onChange={() => toggleM.mutate({ id: sub.id, done: !isDone, prevStatus: sub.status })}
                    title={isDone ? 'Снять отметку «Выполнено»' : 'Подтвердить выполнение (доступно только тимлиду)'}
                    style={{ cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: isDone ? 'var(--c-gray-400)' : 'var(--c-gray-800)', textDecoration: isDone ? 'line-through' : 'none' }}>
                    {sub.title}
                  </span>
                  {name && (
                    <span style={{ fontSize: 11, color: 'var(--c-gray-500)', whiteSpace: 'nowrap' }}>{name.split(' ')[0]}</span>
                  )}
                  {sub.deadline && <Deadline date={sub.deadline} compact />}
                  <StatusPill status={sub.status} />
                  <button
                    className="iconbtn"
                    title="Редактировать"
                    disabled={isDone}
                    onClick={() => startEdit({ id: sub.id, title: sub.title, worker: sub.worker, deadline: sub.deadline })}
                    style={{ color: 'var(--c-gray-400)' }}
                  >
                    <SidebarIcon name="edit" size={14} />
                  </button>
                  <button
                    className="iconbtn"
                    title="Удалить"
                    disabled={deleteM.isPending}
                    onClick={() => deleteM.mutate(sub.id)}
                    style={{ color: 'var(--c-gray-400)' }}
                  >
                    <SidebarIcon name="trash" size={14} />
                  </button>
                  </div>
                  <Attachments kind="subtask" id={sub.id} canDelete collapsible compact />
                </div>
              );
            })}
          </div>
        </div>

        {}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 20 }}>
        <div className="card">
          <div className="card__head">
            <span className="card__title">Добавить подзадачу</span>
          </div>
          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label className="field__label">Название <span style={{ color: 'var(--c-error)' }}>*</span></label>
              <input className="input" placeholder="Что нужно сделать?" value={form.title} onChange={e => { setAddError(''); setForm(f => ({ ...f, title: e.target.value })); }} />
              {addError && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{addError}</div>}
            </div>

            <div className="field">
              <label className="field__label">Описание</label>
              <textarea className="textarea" placeholder="Детали..." value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} rows={2} />
            </div>

            <div className="field">
              <label className="field__label">Исполнитель</label>
              <select className="select" value={form.worker} onChange={e => setForm(f => ({ ...f, worker: e.target.value }))}>
                <option value="">Без исполнителя</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label className="field__label">Дедлайн</label>
              <input className="input" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>

            <button
              className="btn btn--primary"
              onClick={handleAdd}
              disabled={!form.title.trim() || addM.isPending}
              style={{ width: '100%', justifyContent: 'center', opacity: addM.isPending ? 0.7 : 1 }}
            >
              <SidebarIcon name="plus" size={14} />
              {addM.isPending ? 'Добавление…' : 'Добавить подзадачу'}
            </button>
          </div>
        </div>
        <div className="card">
          <div className="card__head">
            <span className="card__title">Файлы задачи</span>
          </div>
          <div className="card__body">
            <Attachments kind="task" id={taskId} canDelete />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
