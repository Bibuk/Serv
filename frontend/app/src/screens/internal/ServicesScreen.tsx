import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store/appStore';
import {
  getServices, createService, updateService,
  getApplications, createApplication, updateApplication, setApplicationArchived,
  getTeams,
} from '../../api';
import type { Service, App, ServiceCategory, Priority } from '../../types';


const PRESET_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#EC4899', '#0EA5E9', '#10B981', '#6366F1', '#F59E0B', '#8B5CF6'];

const CATEGORIES: Record<ServiceCategory, { label: string; color: string; bg: string }> = {
  communications: { label: 'Коммуникации',        color: '#2563EB', bg: 'rgba(37,99,235,0.10)' },
  networks:       { label: 'Сети',                 color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  access:         { label: 'Доступы и ИБ',         color: '#D97706', bg: 'rgba(217,119,6,0.10)' },
  office:         { label: 'Офисная инфра',        color: '#6B7280', bg: 'rgba(107,114,128,0.10)' },
  logistics:      { label: 'Логистика',            color: '#0EA5E9', bg: 'rgba(14,165,233,0.10)' },
  finance:        { label: 'Финансы',              color: '#6366F1', bg: 'rgba(99,102,241,0.10)' },
  sales:          { label: 'Продажи / CRM',        color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  infrastructure: { label: 'Инфраструктура',       color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)' },
  business_apps:  { label: 'Бизнес-приложения',   color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
};
const CATEGORY_KEYS = Object.keys(CATEGORIES) as ServiceCategory[];

const PRIORITIES: Record<Priority, { label: string; color: string }> = {
  critical: { label: 'Критичный', color: '#DC2626' },
  high:     { label: 'Высокий',   color: '#D97706' },
  medium:   { label: 'Средний',   color: '#2563EB' },
  low:      { label: 'Низкий',    color: '#6B7280' },
};

const svcCategory = (s: Service): ServiceCategory => (s.category && CATEGORIES[s.category] ? s.category : 'infrastructure');
const svcStatus = (s: Service): 'active' | 'archived' => (s.status === 'archived' ? 'archived' : 'active');
const svcReaction = (s: Service): number => s.sla?.reaction ?? 4;
const svcResolution = (s: Service): number => s.sla?.resolution ?? 24;
const svcPriority = (s: Service): Priority => s.defaultPriority ?? 'medium';


const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' };
const inputStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', background: 'var(--bg-surface)' };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };

const DropMenu: React.FC<{ children: React.ReactNode; align?: 'right' | 'left' }> = ({ children, align = 'right' }) => (
  <div style={{ position: 'absolute', top: '100%', [align]: 0, zIndex: 50, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--sh-lg)', minWidth: 180, padding: '4px 0', marginTop: 4 }}>{children}</div>
);
const MenuItem: React.FC<{ danger?: boolean; active?: boolean; onClick: () => void; children: React.ReactNode }> = ({ danger, active, onClick, children }) => (
  <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: active ? 'var(--c-blue-50)' : 'none', border: 'none', fontSize: 13, cursor: 'pointer', color: danger ? '#DC2626' : active ? '#2563EB' : 'var(--c-gray-700)', fontWeight: active ? 600 : 400 }}>{children}</button>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; width?: number }> = ({ title, onClose, children, width = 480 }) => (
  <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ background: 'var(--bg-surface)', borderRadius: 12, width, padding: 24, boxShadow: 'var(--sh-xl)', maxHeight: '92vh', overflowY: 'auto' }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, color: 'var(--c-gray-900)' }}>{title}</div>
      {children}
    </div>
  </div>
);

const CategoryBadge: React.FC<{ category: ServiceCategory }> = ({ category }) => {
  const c = CATEGORIES[category];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  );
};

const SLABadge: React.FC<{ reaction: number; resolution: number }> = ({ reaction, resolution }) => {
  const fmt = (h: number) => h < 1 ? `${Math.round(h * 60)} мин` : `${h} ч`;
  return (
    <span style={{ fontSize: 12, color: 'var(--c-gray-600)', whiteSpace: 'nowrap' }}>
      <span title="Время реакции" style={{ fontWeight: 600 }}>{fmt(reaction)}</span>
      <span style={{ color: 'var(--c-gray-300)', margin: '0 4px' }}>/</span>
      <span title="Время решения">{fmt(resolution)}</span>
    </span>
  );
};

const StatusBadge: React.FC<{ status: 'active' | 'archived' }> = ({ status }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600,
    background: status === 'active' ? 'rgba(5,150,105,0.10)' : 'rgba(107,114,128,0.10)',
    color: status === 'active' ? '#059669' : '#6B7280',
  }}>
    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
    {status === 'active' ? 'Активен' : 'Архив'}
  </span>
);


interface ServiceForm {
  name: string; description: string; color: string;
  category: ServiceCategory; responsibleTeamId: string;
  defaultPriority: Priority; slaReaction: number; slaResolution: number;
}
const emptyServiceForm: ServiceForm = {
  name: '', description: '', color: '#2563EB',
  category: 'infrastructure', responsibleTeamId: '',
  defaultPriority: 'medium', slaReaction: 4, slaResolution: 24,
};

const ServiceFormBody: React.FC<{
  form: ServiceForm; setForm: React.Dispatch<React.SetStateAction<ServiceForm>>;
  busy: boolean; error: string; submitLabel: string;
  onSubmit: () => void; onCancel: () => void;
  teams: Array<{ id: string; name: string }>;
}> = ({ form, setForm, busy, error, submitLabel, onSubmit, onCancel, teams }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={labelStyle}>Название сервиса</label>
      <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Например: Электронная почта и календарь" autoFocus />
    </div>

    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={labelStyle}>Категория</label>
        <select style={selectStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ServiceCategory }))}>
          {CATEGORY_KEYS.map(k => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
        </select>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={labelStyle}>Ответственная группа</label>
        <select style={selectStyle} value={form.responsibleTeamId} onChange={e => setForm(f => ({ ...f, responsibleTeamId: e.target.value }))}>
          <option value="">— не назначена —</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={labelStyle}>Приоритет по умолчанию</label>
        <select style={selectStyle} value={form.defaultPriority} onChange={e => setForm(f => ({ ...f, defaultPriority: e.target.value as Priority }))}>
          {(Object.keys(PRIORITIES) as Priority[]).map(p => <option key={p} value={p}>{PRIORITIES[p].label}</option>)}
        </select>
      </div>
    </div>

    <div>
      <label style={{ ...labelStyle, display: 'block', marginBottom: 8 }}>SLA — время реакции / решения</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, color: 'var(--c-gray-400)' }}>Реакция (ч)</label>
          <input type="number" min={0.25} step={0.25} style={inputStyle} value={form.slaReaction}
            onChange={e => setForm(f => ({ ...f, slaReaction: parseFloat(e.target.value) || 1 }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, color: 'var(--c-gray-400)' }}>Решение (ч)</label>
          <input type="number" min={0.5} step={0.5} style={inputStyle} value={form.slaResolution}
            onChange={e => setForm(f => ({ ...f, slaResolution: parseFloat(e.target.value) || 4 }))} />
        </div>
      </div>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={labelStyle}>Описание (для операторов)</label>
      <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        placeholder="Краткое описание: что включает, какие системы, особенности..." />
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={labelStyle}>Цвет метки</label>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {PRESET_COLORS.map(c => (
          <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: form.color === c ? '3px solid var(--c-gray-900)' : '2px solid transparent', cursor: 'pointer' }} />
        ))}
      </div>
    </div>

    {error && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 500 }}>{error}</div>}
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
      <button className="btn btn--outline" onClick={onCancel} disabled={busy}>Отмена</button>
      <button className="btn btn--primary" onClick={onSubmit} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>{busy ? '…' : submitLabel}</button>
    </div>
  </div>
);


interface AppForm { name: string; description: string; color: string; linkedServices: string[] }
const emptyAppForm: AppForm = { name: '', description: '', color: '#2563EB', linkedServices: [] };

const AppFormBody: React.FC<{
  form: AppForm; setForm: React.Dispatch<React.SetStateAction<AppForm>>;
  busy: boolean; error: string; submitLabel: string;
  onSubmit: () => void; onCancel: () => void;
  allServices: Service[];
}> = ({ form, setForm, busy, error, submitLabel, onSubmit, onCancel, allServices }) => {
  const toggleSvc = (id: string) => setForm(f => ({
    ...f,
    linkedServices: f.linkedServices.includes(id) ? f.linkedServices.filter(s => s !== id) : [...f.linkedServices, id],
  }));

  const activeServices = allServices.filter(s => svcStatus(s) === 'active');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={labelStyle}>Название приложения</label>
        <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Например: 1С:Бухгалтерия" autoFocus />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={labelStyle}>Описание</label>
        <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Функция приложения, пользователи, ссылка на документацию..." />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={labelStyle}>Реализует сервисы</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 0' }}>
          {activeServices.map(svc => {
            const checked = form.linkedServices.includes(svc.id);
            return (
              <label key={svc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', cursor: 'pointer', background: checked ? 'var(--c-blue-50)' : 'none' }}>
                <input type="checkbox" checked={checked} onChange={() => toggleSvc(svc.id)} style={{ accentColor: '#2563EB' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: svc.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--c-gray-800)' }}>{svc.name}</span>
              </label>
            );
          })}
          {activeServices.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--c-gray-400)' }}>Нет активных сервисов</div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={labelStyle}>Цвет метки</label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: form.color === c ? '3px solid var(--c-gray-900)' : '2px solid transparent', cursor: 'pointer' }} />
          ))}
        </div>
      </div>
      {error && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 500 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="btn btn--outline" onClick={onCancel} disabled={busy}>Отмена</button>
        <button className="btn btn--primary" onClick={onSubmit} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>{busy ? '…' : submitLabel}</button>
      </div>
    </div>
  );
};


export const ServicesScreen: React.FC = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'services' | 'apps'>('services');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<ServiceCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('active');
  const setToast = useAppStore(s => s.setToast);
  const tickets = useAppStore(s => s.tickets);

  const servicesQ = useQuery({ queryKey: ['services'], queryFn: getServices });
  const appsQ = useQuery({ queryKey: ['applications'], queryFn: getApplications });
  const teamsQ = useQuery({ queryKey: ['teams'], queryFn: getTeams });

  const allServices = React.useMemo(() => servicesQ.data ?? [], [servicesQ.data]);
  const allApps = React.useMemo(() => appsQ.data ?? [], [appsQ.data]);
  const teams = React.useMemo(() => (teamsQ.data ?? []).map(t => ({ id: t.id, name: t.name })), [teamsQ.data]);
  const teamName = (id?: string) => (id ? teams.find(t => t.id === id)?.name ?? '' : '');

  const [svcModal, setSvcModal] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null);
  const [appModal, setAppModal] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null);
  const [svcForm, setSvcForm] = useState<ServiceForm>(emptyServiceForm);
  const [appForm, setAppForm] = useState<AppForm>(emptyAppForm);
  const [formError, setFormError] = useState('');

  const filteredServices = React.useMemo(() => allServices.filter(s => {
    if (filterStatus !== 'all' && svcStatus(s) !== filterStatus) return false;
    if (filterCategory !== 'all' && svcCategory(s) !== filterCategory) return false;
    return true;
  }), [allServices, filterStatus, filterCategory]);

  const tasks = useAppStore(s => s.tasks);
  const svcIncidentCounts = React.useMemo(() =>
    tasks.reduce<Record<string, number>>((acc, t) => {
      if (!['done', 'reject', 'archive'].includes(t.status) && t.service) {
        acc[t.service] = (acc[t.service] ?? 0) + 1;
      }
      return acc;
    }, {}), [tasks]);
  const incidentsFor = (s: Service) => (svcIncidentCounts[s.id] ?? 0) + (svcIncidentCounts[s.name] ?? 0);

  const appTicketCounts = React.useMemo(() =>
    tickets.reduce<Record<string, number>>((acc, t) => {
      if (['new', 'accepted', 'inprog'].includes(t.status) && t.app) {
        acc[t.app] = (acc[t.app] ?? 0) + 1;
      }
      return acc;
    }, {}), [tickets]);
  const ticketsFor = (a: App) => (appTicketCounts[a.id] ?? 0) + (appTicketCounts[a.name] ?? 0);

  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const invalidateSvc = () => qc.invalidateQueries({ queryKey: ['services'] });
  const invalidateApp = () => qc.invalidateQueries({ queryKey: ['applications'] });

  const svcSaveM = useMutation({
    mutationFn: () => {
      const payload = {
        name: svcForm.name.trim(), description: svcForm.description, color: svcForm.color,
        category: svcForm.category, responsibleTeamId: svcForm.responsibleTeamId || null,
        defaultPriority: svcForm.defaultPriority,
        slaReaction: svcForm.slaReaction, slaResolution: svcForm.slaResolution,
      };
      return svcModal?.mode === 'edit'
        ? updateService(svcModal.id!, payload)
        : createService({ ...payload, status: 'active' });
    },
    onSuccess: () => {
      invalidateSvc(); setSvcModal(null);
      setToast({ kind: 'success', msg: svcModal?.mode === 'edit' ? 'Сервис обновлён' : 'Сервис добавлен' });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const appSaveM = useMutation({
    mutationFn: () => appModal?.mode === 'edit'
      ? updateApplication(appModal.id!, { name: appForm.name.trim(), description: appForm.description, color: appForm.color, serviceIds: appForm.linkedServices })
      : createApplication({ name: appForm.name.trim(), description: appForm.description, color: appForm.color, serviceIds: appForm.linkedServices }),
    onSuccess: () => {
      invalidateApp(); setAppModal(null);
      setToast({ kind: 'success', msg: appModal?.mode === 'edit' ? 'Приложение обновлено' : 'Приложение добавлено' });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const svcArchiveM = useMutation({
    mutationFn: ({ svc, archived }: { svc: Service; archived: boolean }) =>
      updateService(svc.id, { name: svc.name, status: archived ? 'archived' : 'active' }),
    onSuccess: (_d, { archived }) => {
      invalidateSvc();
      setToast({ kind: 'success', msg: archived ? 'Сервис архивирован' : 'Сервис восстановлён' });
    },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const appArchiveM = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => setApplicationArchived(id, archived),
    onSuccess: () => { invalidateApp(); setToast({ kind: 'success', msg: 'Статус приложения изменён' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const openCreateSvc = () => { setSvcForm(emptyServiceForm); setFormError(''); setSvcModal({ mode: 'create' }); };
  const openCreateApp = () => { setAppForm(emptyAppForm); setFormError(''); setAppModal({ mode: 'create' }); };

  const openEditSvc = (s: Service) => {
    setSvcForm({
      name: s.name, description: s.description ?? '', color: s.color,
      category: svcCategory(s), responsibleTeamId: s.responsibleTeam ?? '',
      defaultPriority: svcPriority(s), slaReaction: svcReaction(s), slaResolution: svcResolution(s),
    });
    setFormError(''); setSvcModal({ mode: 'edit', id: s.id });
  };

  const openEditApp = (a: App) => {
    setAppForm({ name: a.name, description: a.description ?? '', color: a.color, linkedServices: a.services ?? [] });
    setFormError(''); setAppModal({ mode: 'edit', id: a.id });
  };

  const submitSvc = () => { if (svcForm.name.trim().length < 2) { setFormError('Минимум 2 символа'); return; } setFormError(''); svcSaveM.mutate(); };
  const submitApp = () => { if (appForm.name.trim().length < 2) { setFormError('Минимум 2 символа'); return; } setFormError(''); appSaveM.mutate(); };

  const catCounts = React.useMemo(() => {
    const counts: Partial<Record<ServiceCategory, number>> = {};
    allServices.filter(s => svcStatus(s) === 'active').forEach(s => {
      const c = svcCategory(s);
      counts[c] = (counts[c] ?? 0) + 1;
    });
    return counts;
  }, [allServices]);

  const filteredApps = allApps.filter(a => filterStatus === 'all' || a.status === filterStatus);

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Сервисы и приложения</h1>
          <p className="page-sub muted" style={{ margin: '2px 0 0' }}>
            Каталог сервисов и систем, по которым 2ЛТП принимает заявки
          </p>
        </div>
        <button className="btn btn--primary" onClick={tab === 'services' ? openCreateSvc : openCreateApp}>
          + {tab === 'services' ? 'Добавить сервис' : 'Добавить приложение'}
        </button>
      </div>

      {}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['services', 'apps'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 18px', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? '#2563EB' : 'var(--c-gray-600)', borderBottom: tab === t ? '2px solid #2563EB' : '2px solid transparent', marginBottom: -1 }}>
              {t === 'services' ? `Сервисы (${allServices.length})` : `Приложения (${allApps.length})`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          {tab === 'services' && (
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as ServiceCategory | 'all')}
              style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--border-subtle)', borderRadius: 7, cursor: 'pointer', background: 'var(--bg-surface)', color: filterCategory !== 'all' ? '#2563EB' : 'var(--c-gray-600)', fontWeight: filterCategory !== 'all' ? 600 : 400 }}>
              <option value="all">Все категории</option>
              {CATEGORY_KEYS.map(k => <option key={k} value={k}>{CATEGORIES[k].label} {catCounts[k] ? `(${catCounts[k]})` : ''}</option>)}
            </select>
          )}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
            style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--border-subtle)', borderRadius: 7, cursor: 'pointer', background: 'var(--bg-surface)', color: 'var(--c-gray-600)' }}>
            <option value="active">Только активные</option>
            <option value="archived">Только архив</option>
            <option value="all">Все</option>
          </select>
        </div>
      </div>

      {}
      {tab === 'services' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {servicesQ.isLoading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>Загрузка…</div>
          ) : filteredServices.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: 'var(--c-gray-700)', marginBottom: 6 }}>
                {filterCategory !== 'all' || filterStatus !== 'active' ? 'Нет сервисов по выбранным фильтрам' : 'Каталог сервисов пуст'}
              </div>
              <div style={{ fontSize: 12 }}>Добавьте сервисы, по которым 2ЛТП принимает заявки</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '9px 16px', textAlign: 'left', ...labelStyle }}>Сервис</th>
                  <th style={{ padding: '9px 16px', textAlign: 'left', ...labelStyle }}>Категория</th>
                  <th style={{ padding: '9px 16px', textAlign: 'left', ...labelStyle }}>Ответственная группа</th>
                  <th style={{ padding: '9px 16px', textAlign: 'left', ...labelStyle }}>SLA (реакция / решение)</th>
                  <th style={{ padding: '9px 16px', textAlign: 'center', ...labelStyle, width: 80 }}>Инциденты</th>
                  <th style={{ padding: '9px 16px', textAlign: 'left', ...labelStyle, width: 110 }}>Статус</th>
                  <th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((svc, i) => (
                  <tr key={svc.id} style={{ borderBottom: i < filteredServices.length - 1 ? '1px solid var(--border-subtle)' : 'none', opacity: svcStatus(svc) === 'archived' ? 0.55 : 1 }}>
                    <td style={{ padding: '11px 0', minWidth: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: 4, height: 36, borderRadius: '0 2px 2px 0', background: svc.color, marginRight: 14, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-gray-900)' }}>{svc.name}</div>
                          {svc.description && <div style={{ fontSize: 11, color: 'var(--c-gray-400)', marginTop: 1, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <CategoryBadge category={svcCategory(svc)} />
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--c-gray-600)' }}>
                      {teamName(svc.responsibleTeam) || <span style={{ color: 'var(--c-gray-300)' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <SLABadge reaction={svcReaction(svc)} resolution={svcResolution(svc)} />
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      {incidentsFor(svc) > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 20, padding: '0 7px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(220,38,38,0.10)', color: '#DC2626' }}>
                          {incidentsFor(svc)}
                        </span>
                      ) : <span style={{ fontSize: 12, color: 'var(--c-gray-300)' }}>0</span>}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <StatusBadge status={svcStatus(svc)} />
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ position: 'relative' }} ref={openMenu === svc.id ? menuRef : undefined}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'var(--c-gray-400)', fontSize: 16 }} onClick={() => setOpenMenu(p => p === svc.id ? null : svc.id)}>⋯</button>
                        {openMenu === svc.id && (
                          <DropMenu>
                            <MenuItem onClick={() => { setOpenMenu(null); openEditSvc(svc); }}>Редактировать</MenuItem>
                            <MenuItem onClick={() => { setOpenMenu(null); svcArchiveM.mutate({ svc, archived: svcStatus(svc) === 'active' }); }}>
                              {svcStatus(svc) === 'active' ? 'Архивировать' : 'Восстановить'}
                            </MenuItem>
                          </DropMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {}
      {tab === 'apps' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {appsQ.isLoading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>Загрузка…</div>
          ) : filteredApps.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: 'var(--c-gray-700)', marginBottom: 6 }}>Приложения не найдены</div>
              <div style={{ fontSize: 12 }}>Добавьте приложения, по которым принимаются заявки</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '9px 16px', textAlign: 'left', ...labelStyle }}>Приложение</th>
                  <th style={{ padding: '9px 16px', textAlign: 'left', ...labelStyle }}>Реализует сервис</th>
                  <th style={{ padding: '9px 16px', textAlign: 'left', ...labelStyle }}>Описание</th>
                  <th style={{ padding: '9px 16px', textAlign: 'center', ...labelStyle, width: 110 }}>Открытых заявок</th>
                  <th style={{ padding: '9px 16px', textAlign: 'left', ...labelStyle, width: 110 }}>Статус</th>
                  <th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {filteredApps.map((app, i, arr) => {
                  const openCount = ticketsFor(app);
                  const linkedSvcNames = (app.services ?? []).map(sid => allServices.find(s => s.id === sid)?.name).filter(Boolean);
                  return (
                    <tr key={app.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', opacity: app.status === 'archived' ? 0.55 : 1 }}>
                      <td style={{ padding: '11px 0', minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ width: 4, height: 36, borderRadius: '0 2px 2px 0', background: app.color, marginRight: 14, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-gray-900)' }}>{app.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', maxWidth: 220 }}>
                        {linkedSvcNames.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {linkedSvcNames.map(n => (
                              <span key={n} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--c-gray-100)', color: 'var(--c-gray-600)', whiteSpace: 'nowrap' }}>{n}</span>
                            ))}
                          </div>
                        ) : <span style={{ fontSize: 12, color: 'var(--c-gray-300)' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--c-gray-500)', maxWidth: 240 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {app.description || <span style={{ color: 'var(--c-gray-300)' }}>—</span>}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                        {openCount > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 20, padding: '0 7px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(220,38,38,0.10)', color: '#DC2626' }}>
                            {openCount}
                          </span>
                        ) : <span style={{ fontSize: 12, color: 'var(--c-gray-300)' }}>0</span>}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <StatusBadge status={app.status} />
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <div style={{ position: 'relative' }} ref={openMenu === app.id ? menuRef : undefined}>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'var(--c-gray-400)', fontSize: 16 }} onClick={() => setOpenMenu(p => p === app.id ? null : app.id)}>⋯</button>
                          {openMenu === app.id && (
                            <DropMenu>
                              <MenuItem onClick={() => { setOpenMenu(null); openEditApp(app); }}>Редактировать</MenuItem>
                              <MenuItem onClick={() => { setOpenMenu(null); appArchiveM.mutate({ id: app.id, archived: app.status === 'active' }); }}>
                                {app.status === 'active' ? 'Архивировать' : 'Восстановить'}
                              </MenuItem>
                            </DropMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {}
      {svcModal && (
        <Modal title={svcModal.mode === 'edit' ? 'Редактировать сервис' : 'Новый сервис'} onClose={() => setSvcModal(null)}>
          <ServiceFormBody form={svcForm} setForm={setSvcForm} busy={svcSaveM.isPending} error={formError}
            submitLabel={svcModal.mode === 'edit' ? 'Сохранить' : 'Добавить'} onCancel={() => setSvcModal(null)} onSubmit={submitSvc}
            teams={teams} />
        </Modal>
      )}
      {appModal && (
        <Modal title={appModal.mode === 'edit' ? 'Редактировать приложение' : 'Новое приложение'} onClose={() => setAppModal(null)}>
          <AppFormBody form={appForm} setForm={setAppForm} busy={appSaveM.isPending} error={formError}
            submitLabel={appModal.mode === 'edit' ? 'Сохранить' : 'Добавить'} onCancel={() => setAppModal(null)} onSubmit={submitApp}
            allServices={allServices} />
        </Modal>
      )}
    </div>
  );
};
