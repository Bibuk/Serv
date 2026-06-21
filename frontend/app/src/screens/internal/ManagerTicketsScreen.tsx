import React from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { Ticket, TicketStatus, TaskPrefill, Priority } from '../../types';
import { STATUSES } from '../../data/mock';
import { matchesEntity } from '../../utils/catalog';
import { StatusPill, PriorityBadge, AppTag, ReasonModal } from '../../components';
import { ruDate } from '../../utils/helpers';
import { SidebarIcon } from '../../shells';
import { useAppStore } from '../../store/appStore';
import { updateTicketStatus, updateTicketPriority, rejectTicket, getTicketComments, getServices, getApplications } from '../../api';
import { clampPriority } from '../../utils/serviceMeta';
import type { Service, App } from '../../types';

interface Props {
  tickets: Ticket[];
}

// Build a task prefill from a client ticket: carry over title/description/
// priority, link the ticket, and suggest the service from the application→
// service mapping. The responsible group is derived in the modal from the
// chosen service, so it isn't part of the prefill.
function buildPrefillFromTicket(ticket: Ticket, apps: App[], services: Service[]): TaskPrefill {
  // ticket.app may be an id (mock) or a name (real API) — match on both.
  const app = apps.find(a => a.id === ticket.app || a.name === ticket.app);
  const serviceId = app?.services?.[0] ?? '';
  const svc = serviceId ? services.find(s => s.id === serviceId) : undefined;
  return {
    title: ticket.title,
    desc: ticket.desc,
    priority: clampPriority(svc?.defaultPriority ?? ticket.priority),
    ticketId: ticket.id,
    serviceId,
    appId: ticket.app,
  };
}

const exportTicketsCSV = (tickets: Ticket[]) => {
  const rows = [
    ['ID', 'Название', 'Статус', 'Приоритет', 'Приложение', 'Создана', 'Обновлена'],
    ...tickets.map(t => [t.id, t.title, t.status, t.priority, t.app, t.created, t.updated]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};

// Contextual workflow actions per current status (frontend status values).
const ACTIONS: Record<string, Array<{ to: TicketStatus | 'reject'; label: string; primary?: boolean; danger?: boolean }>> = {
  new:      [{ to: 'inprog', label: 'Взять в обработку', primary: true }, { to: 'reject', label: 'Отклонить', danger: true }],
  inprog:   [{ to: 'reject', label: 'Отклонить', danger: true }],
  accepted: [{ to: 'closed', label: 'Закрыть заявку', primary: true }, { to: 'reject', label: 'Отклонить', danger: true }],
};

export const ManagerTicketsScreen: React.FC<Props> = ({ tickets }) => {
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [app, setApp] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const setToast = useAppStore(s => s.setToast);
  const setTickets = useAppStore(s => s.setTickets);
  const openCreateTask = useAppStore(s => s.openCreateTask);

  const servicesQ = useQuery({ queryKey: ['services'], queryFn: () => getServices() });
  const appsQ = useQuery({ queryKey: ['applications'], queryFn: () => getApplications() });

  const convertToTask = (ticket: Ticket) =>
    openCreateTask(buildPrefillFromTicket(ticket, appsQ.data ?? [], servicesQ.data ?? []));

  const selectedTicket = tickets.find(t => t.id === selectedId) ?? null;

  const commentsQ = useQuery({
    queryKey: ['ticket-comments', selectedId],
    queryFn: () => getTicketComments(selectedId!),
    enabled: !!selectedId,
  });

  const applyTicket = (updated: Ticket) => {
    setTickets(prev => prev.map(t => (t.id === updated.id ? { ...t, ...updated } : t)));
  };

  // Ticket id awaiting a rejection reason (drives the ReasonModal).
  const [rejectId, setRejectId] = React.useState<string | null>(null);

  const actionM = useMutation({
    mutationFn: ({ id, to }: { id: string; to: TicketStatus }) => updateTicketStatus(id, to),
    onSuccess: (updated) => { applyTicket(updated); setToast({ kind: 'success', msg: 'Статус заявки обновлён' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const rejectM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectTicket(id, reason),
    onSuccess: (updated) => { applyTicket(updated); setRejectId(null); setToast({ kind: 'success', msg: 'Заявка отклонена' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const priorityM = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: Priority }) => updateTicketPriority(id, priority),
    onSuccess: (updated) => { applyTicket(updated); setToast({ kind: 'success', msg: 'Приоритет обновлён' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  // Bulk "take into processing" for the selected new tickets.
  const bulkM = useMutation({
    mutationFn: async (ids: string[]) => Promise.all(ids.map(id => updateTicketStatus(id, 'inprog'))),
    onSuccess: (updated) => {
      setTickets(prev => prev.map(t => updated.find(u => u.id === t.id) ?? t));
      setChecked(new Set());
      setToast({ kind: 'success', msg: `Взято в обработку: ${updated.length}` });
    },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const apps = appsQ.data ?? [];
  const filtered = tickets.filter(t => {
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (status && t.status !== status) return false;
    if (!matchesEntity(t.app, app, apps)) return false;
    return true;
  });

  // Only "new" tickets can be bulk-accepted; selection is scoped to them.
  const selectableIds = filtered.filter(t => t.status === 'new').map(t => t.id);
  const checkedNew = selectableIds.filter(id => checked.has(id));
  const allNewChecked = selectableIds.length > 0 && checkedNew.length === selectableIds.length;

  const toggleAll = () => {
    setChecked(prev => {
      const next = new Set(prev);
      if (allNewChecked) selectableIds.forEach(id => next.delete(id));
      else selectableIds.forEach(id => next.add(id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Заявки клиентов</div>
          <div className="page-sub">{filtered.length} из {tickets.length} заявок</div>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--secondary btn--sm" onClick={() => exportTicketsCSV(filtered)}>
            <SidebarIcon name="download" size={14} /> Экспорт
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="input-wrap">
          <SidebarIcon name="search" size={13} />
          <input className="input" placeholder="Поиск по заявкам" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Статус: все</option>
          {(['new', 'accepted', 'inprog', 'closed', 'rejected'] as const).map(k => (
            <option key={k} value={k}>{STATUSES[k]?.label}</option>
          ))}
        </select>
        <select className="select" value={app} onChange={e => setApp(e.target.value)}>
          <option value="">Приложение: все</option>
          {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Bulk action bar */}
      {checkedNew.length > 0 && (
        <div style={{
          background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
          padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1D4ED8' }}>Выбрано новых заявок: {checkedNew.length}</span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn btn--primary btn--sm" disabled={bulkM.isPending} onClick={() => bulkM.mutate(checkedNew)}>
              <SidebarIcon name="inbox" size={13} /> Взять в обработку
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setChecked(new Set())}>
              <SidebarIcon name="x" size={13} /> Снять выбор
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card__body card__body--flush">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40, paddingLeft: 14 }}>
                  <input
                    type="checkbox"
                    checked={allNewChecked}
                    ref={el => { if (el) el.indeterminate = checkedNew.length > 0 && !allNewChecked; }}
                    onChange={toggleAll}
                    disabled={selectableIds.length === 0}
                    style={{ cursor: 'pointer' }}
                    title="Выбрать новые заявки"
                  />
                </th>
                <th>Заявка</th><th>Приложение</th><th>Приоритет</th><th>Создана</th><th>Статус</th><th>Задача</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="table__row-link" onClick={() => setSelectedId(t.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ paddingLeft: 14 }} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked.has(t.id)}
                      disabled={t.status !== 'new'}
                      onChange={() => toggleOne(t.id)}
                      style={{ cursor: t.status === 'new' ? 'pointer' : 'not-allowed' }}
                    />
                  </td>
                  <td><span className="bold">{t.title}</span></td>
                  <td><AppTag id={t.app} /></td>
                  <td><PriorityBadge priority={t.priority} /></td>
                  <td className="muted" style={{ fontSize: 12 }}>{ruDate(t.created)}</td>
                  <td><StatusPill status={t.status} /></td>
                  <td>
                    {t.taskId
                      ? <span className="mono" style={{ color: 'var(--c-blue-500)', fontSize: 12 }}>{t.taskId}</span>
                      : <button className="btn btn--ghost btn--sm" onClick={e => { e.stopPropagation(); convertToTask(t); }}>В задачу</button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--c-gray-400)' }}>
                    <SidebarIcon name="inbox" size={32} />
                    <div style={{ marginTop: 8, fontSize: 14 }}>Заявки не найдены</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTicket && (
        <div onClick={e => { if (e.target === e.currentTarget) setSelectedId(null); }} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <div style={{ width: 480, height: '100vh', background: 'var(--bg-surface)', boxShadow: 'var(--sh-xl)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusPill status={selectedTicket.status} />
              <div style={{ flex: 1 }} />
              <button className="iconbtn" onClick={() => setSelectedId(null)}><CloseOutlined style={{ fontSize: 14, color: 'var(--c-gray-500)' }} /></button>
            </div>

            <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--c-gray-900)', lineHeight: 1.3 }}>{selectedTicket.title}</h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--c-gray-600)', lineHeight: 1.6 }}>{selectedTicket.desc}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px 14px', background: 'var(--c-gray-50)', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 13 }}>
                <div><div style={{ fontSize: 11, color: 'var(--c-gray-400)', fontWeight: 500, textTransform: 'uppercase', marginBottom: 3 }}>Приложение</div><AppTag id={selectedTicket.app} /></div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--c-gray-400)', fontWeight: 500, textTransform: 'uppercase', marginBottom: 3 }}>Приоритет</div>
                  <select
                    value={selectedTicket.priority}
                    disabled={priorityM.isPending}
                    onChange={e => priorityM.mutate({ id: selectedTicket.id, priority: e.target.value as Priority })}
                    style={{ fontSize: 13, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--c-gray-900)', cursor: 'pointer' }}
                  >
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                    <option value="critical">Критический</option>
                  </select>
                </div>
                <div><div style={{ fontSize: 11, color: 'var(--c-gray-400)', fontWeight: 500, textTransform: 'uppercase', marginBottom: 3 }}>Создана</div><span style={{ color: 'var(--c-gray-700)' }}>{ruDate(selectedTicket.created)}</span></div>
                <div><div style={{ fontSize: 11, color: 'var(--c-gray-400)', fontWeight: 500, textTransform: 'uppercase', marginBottom: 3 }}>Клиент</div><span style={{ color: 'var(--c-gray-700)' }}>{selectedTicket.client}</span></div>
              </div>

              {/* Convert to task — the primary dispatcher action */}
              {!selectedTicket.taskId && !['closed', 'rejected'].includes(selectedTicket.status) && (
                <button
                  className="btn btn--primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { setSelectedId(null); convertToTask(selectedTicket); }}
                >
                  <SidebarIcon name="plus" size={14} /> Создать задачу из заявки
                </button>
              )}

              {/* Linked task indicator */}
              {selectedTicket.taskId && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                  background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, fontSize: 13, color: '#047857',
                }}>
                  <SidebarIcon name="checkCircle" size={15} />
                  Привязана задача <span className="mono" style={{ fontWeight: 600 }}>{selectedTicket.taskId}</span>
                </div>
              )}

              {/* Workflow actions */}
              {(ACTIONS[selectedTicket.status] ?? []).length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-gray-500)', marginBottom: 8 }}>Действия</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(ACTIONS[selectedTicket.status] ?? []).map(a => (
                      <button
                        key={a.to}
                        className={a.primary ? 'btn btn--primary btn--sm' : 'btn btn--outline btn--sm'}
                        disabled={actionM.isPending}
                        style={a.danger ? { color: '#DC2626', borderColor: '#DC2626' } : undefined}
                        onClick={() => a.to === 'reject'
                          ? setRejectId(selectedTicket.id)
                          : actionM.mutate({ id: selectedTicket.id, to: a.to })}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-gray-500)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Комментарии</div>
                {commentsQ.isLoading ? (
                  <div style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Загрузка…</div>
                ) : (commentsQ.data ?? []).length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Комментариев нет</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(commentsQ.data ?? []).map((c, i) => {
                      const isUserId = (s: string) => !!s && !/\s/.test(s) && /^[a-z]\d+$/i.test(s);
                      const displayAuthor = isUserId(c.author) ? 'Специалист поддержки' : c.author;
                      return (
                      <div key={c.id ?? i} style={{ padding: '10px 12px', background: 'var(--c-gray-50)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-gray-800)' }}>{displayAuthor}</span>
                          {c.visibleToClient && <span style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', borderRadius: 4, padding: '1px 5px' }}>видно клиенту</span>}
                          <span style={{ fontSize: 11, color: 'var(--c-gray-400)', marginLeft: 'auto' }}>{ruDate(c.date.slice(0, 10))}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--c-gray-700)', lineHeight: 1.5 }}>{c.text}</div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectId && (
        <ReasonModal
          title="Отклонить заявку"
          placeholder="Опишите, почему заявка отклоняется…"
          confirmLabel="Отклонить"
          busy={rejectM.isPending}
          onConfirm={reason => rejectM.mutate({ id: rejectId, reason })}
          onClose={() => setRejectId(null)}
        />
      )}
    </>
  );
};
