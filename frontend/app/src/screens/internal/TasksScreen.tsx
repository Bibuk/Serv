import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Task, Priority, TaskStatus } from '../../types';
import { STATUSES, PRIORITIES } from '../../data/mock';
import { StatusPill, PriorityBadge, ServiceTag, Deadline } from '../../components';
import { SidebarIcon } from '../../shells';
import { ruDate } from '../../utils/helpers';
import { useAppStore } from '../../store/appStore';
import { archiveTask, deleteTask, getTeams, getServices, updateTaskStatus } from '../../api';
import { matchesEntity } from '../../utils/catalog';
import { exportTasksCSV } from '../../utils/reportExport';

interface Props {
  tasks: Task[];
  openDrawer: (id: string) => void;
  openCreate: () => void;
  initialSearch?: string;
}

const ITEMS_PER_PAGE = 10;

export const TasksScreen: React.FC<Props> = ({ tasks, openDrawer, openCreate, initialSearch }) => {
  const setTasks = useAppStore(s => s.setTasks);
  const setToast = useAppStore(s => s.setToast);
  const role = useAppStore(s => s.role);
  const canManage = role === 'manager' || role === 'admin';

  const [search, setSearch] = React.useState(initialSearch ?? '');
  const [filterService, setFilterService] = React.useState('');
  const [filterTeam, setFilterTeam] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('');
  const [filterPriority, setFilterPriority] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    if (initialSearch !== undefined) { setSearch(initialSearch); setPage(1); }
  }, [initialSearch]);

  const teamsQ = useQuery({ queryKey: ['teams'], queryFn: () => getTeams() });
  const servicesQ = useQuery({ queryKey: ['services'], queryFn: () => getServices() });
  const teams = React.useMemo(() => (teamsQ.data ?? []).map(t => ({ id: t.id, name: t.name })), [teamsQ.data]);
  const services = React.useMemo(() => (servicesQ.data ?? []).map(s => ({ id: s.id, name: s.name })), [servicesQ.data]);

  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (!matchesEntity(t.service, filterService, services)) return false;
    if (!matchesEntity(t.team, filterTeam, teams)) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const allSelected = paginated.length > 0 && paginated.every(t => selected.has(t.id));
  const someSelected = paginated.some(t => selected.has(t.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        paginated.forEach(t => next.delete(t.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        paginated.forEach(t => next.add(t.id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedCount = selected.size;

  const archiveM = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => archiveTask(id))),
    onSuccess: (_d, ids) => {
      const set = new Set(ids);
      setTasks(prev => prev.map(t => set.has(t.id) ? { ...t, status: 'archive' as TaskStatus } : t));
      setSelected(new Set());
      setToast({ kind: 'success', msg: `Архивировано задач: ${ids.length}` });
    },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const deleteM = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => deleteTask(id))),
    onSuccess: (_d, ids) => {
      const set = new Set(ids);
      setTasks(prev => prev.filter(t => !set.has(t.id)));
      setSelected(new Set());
      setToast({ kind: 'success', msg: `Удалено задач: ${ids.length}` });
    },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const handleArchiveSelected = () => archiveM.mutate(Array.from(selected));
  const handleDeleteSelected = () => deleteM.mutate(Array.from(selected));

  const reopenM = useMutation({
    mutationFn: (id: string) => updateTaskStatus(id, 'inprog'),
    onSuccess: (_d, id) => {
      setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: 'inprog' as TaskStatus } : t)));
      setToast({ kind: 'success', msg: 'Задача возвращена в работу' });
    },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const exportCSV = () => exportTasksCSV(filtered);

  return (
    <div>
      {}
      <div className="page-header">
        <div>
          <h1 className="page-title">Задачи</h1>
          <p className="page-sub">{filtered.length} задач найдено</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--secondary btn--sm" onClick={exportCSV}>
            <SidebarIcon name="download" size={14} />
            Экспорт
          </button>
          <button className="btn btn--primary btn--sm" onClick={openCreate}>
            <SidebarIcon name="plus" size={14} />
            Создать задачу
          </button>
        </div>
      </div>

      {}
      <div className="filters">
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <input
            className="input"
            placeholder="Поиск по названию или ID..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ paddingLeft: 32 }}
          />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-gray-400)', pointerEvents: 'none' }}>
            <SidebarIcon name="search" size={14} />
          </span>
        </div>
        <select className="select" style={{ width: 'auto' }} value={filterService} onChange={e => { setFilterService(e.target.value); setPage(1); }}>
          <option value="">Все сервисы</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={filterTeam} onChange={e => { setFilterTeam(e.target.value); setPage(1); }}>
          <option value="">Все команды</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">Все статусы</option>
          {(Object.keys(STATUSES) as Array<keyof typeof STATUSES>)
            .filter(k => !['new', 'accepted', 'inprog', 'closed', 'rejected'].includes(k))
            .map(k => <option key={k} value={k}>{STATUSES[k].label}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1); }}>
          <option value="">Все приоритеты</option>
          {(Object.keys(PRIORITIES) as Priority[]).map(p => (
            <option key={p} value={p}>{PRIORITIES[p].label}</option>
          ))}
        </select>
        {(search || filterService || filterTeam || filterStatus || filterPriority) && (
          <button className="btn btn--ghost btn--sm" onClick={() => { setSearch(''); setFilterService(''); setFilterTeam(''); setFilterStatus(''); setFilterPriority(''); setPage(1); }}>
            <SidebarIcon name="x" size={13} />
            Сбросить
          </button>
        )}
      </div>

      {}
      {selectedCount > 0 && (
        <div style={{
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1D4ED8' }}>
            Выбрано: {selectedCount}
          </span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn btn--secondary btn--sm" onClick={handleArchiveSelected} disabled={archiveM.isPending || deleteM.isPending}>
              <SidebarIcon name="archive" size={13} />
              В архив
            </button>
            <button className="btn btn--secondary btn--sm" style={{ color: 'var(--c-error)' }} onClick={handleDeleteSelected} disabled={archiveM.isPending || deleteM.isPending}>
              <SidebarIcon name="trash" size={13} />
              Удалить
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setSelected(new Set())}>
              <SidebarIcon name="x" size={13} />
              Снять выбор
            </button>
          </div>
        </div>
      )}

      {}
      <div className="card">
        <div className="card__body--flush">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40, paddingLeft: 14 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>Название / ID</th>
                <th>Сервис</th>
                <th>Команда</th>
                <th>Приоритет</th>
                <th>Дедлайн</th>
                <th>Статус</th>
                <th>Создана</th>
                <th style={{ width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(task => (
                <tr key={task.id} className="table__row-link">
                  <td style={{ paddingLeft: 14 }} onClick={e => { e.stopPropagation(); toggleOne(task.id); }}>
                    <input
                      type="checkbox"
                      checked={selected.has(task.id)}
                      onChange={() => toggleOne(task.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td onClick={() => openDrawer(task.id)}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-gray-800)', marginBottom: 2 }}>
                        {task.title}
                      </div>
                      <span className="mono">{task.id}</span>
                    </div>
                  </td>
                  <td onClick={() => openDrawer(task.id)}><ServiceTag id={task.service} /></td>
                  <td onClick={() => openDrawer(task.id)} style={{ fontSize: 12, color: 'var(--c-gray-600)', whiteSpace: 'nowrap' }}>{task.team}</td>
                  <td onClick={() => openDrawer(task.id)}><PriorityBadge priority={task.priority} /></td>
                  <td onClick={() => openDrawer(task.id)}><Deadline date={task.deadline} compact /></td>
                  <td onClick={() => openDrawer(task.id)}><StatusPill status={task.status} /></td>
                  <td onClick={() => openDrawer(task.id)} style={{ fontSize: 12, color: 'var(--c-gray-500)', whiteSpace: 'nowrap' }}>{ruDate(task.created)}</td>
                  <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    {canManage && (task.status === 'done' || task.status === 'archive') ? (
                      <button
                        className="btn btn--outline btn--sm"
                        style={{ gap: 5 }}
                        disabled={reopenM.isPending}
                        title="Вернуть задачу в работу"
                        onClick={() => reopenM.mutate(task.id)}
                      >
                        <SidebarIcon name="refresh" size={13} /> Вернуть
                      </button>
                    ) : (
                      <button className="iconbtn" onClick={() => openDrawer(task.id)} title="Открыть">
                        <SidebarIcon name="more" size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--c-gray-400)' }}>
                    <SidebarIcon name="inbox" size={32} />
                    <div style={{ marginTop: 8, fontSize: 14 }}>Задачи не найдены</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--c-gray-500)' }}>
            Страница {safePage} из {totalPages} · {filtered.length} задач
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {safePage > 1 && (
              <button className="btn btn--secondary btn--sm" onClick={() => setPage(p => p - 1)}>
                <SidebarIcon name="arrowLeft" size={13} />
                Назад
              </button>
            )}
            <button className="btn btn--secondary btn--sm" style={{ minWidth: 32, justifyContent: 'center', background: 'var(--c-blue-600)', color: '#fff', borderColor: 'var(--c-blue-600)' }}>
              {safePage}
            </button>
            {safePage < totalPages && (
              <button className="btn btn--secondary btn--sm" onClick={() => setPage(p => p + 1)}>
                Вперёд
                <SidebarIcon name="arrowRight" size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
