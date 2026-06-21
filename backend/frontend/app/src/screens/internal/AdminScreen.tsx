import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  TeamOutlined, DesktopOutlined, ApiOutlined, ToolOutlined, ExperimentOutlined,
  MobileOutlined, BankOutlined, EditOutlined, DeleteOutlined, CloseOutlined,
  CodeOutlined, CloudOutlined, RocketOutlined, StarOutlined, SafetyOutlined,
  BarChartOutlined, DatabaseOutlined, GlobalOutlined, CustomerServiceOutlined,
  BugOutlined, ThunderboltOutlined, CrownOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rolePillBg, rolePillFg } from '../../utils/helpers';
import { ROLE_LABEL } from '../../shells';
import { useAppStore } from '../../store/appStore';
import {
  getUsers, createUser, updateUser, deactivateUser, setUserActive,
  getTeams, createTeam, updateTeam, deleteTeam, getAuditLog,
} from '../../api';
import type { TeamDetail } from '../../api';
import type { User, Role, AuditEntry } from '../../types';

interface Props {
  subscreen: 'users' | 'teams' | 'audit-log';
}

const STAFF_ROLES: Array<Role | 'client'> = ['worker', 'teamlead', 'manager', 'admin'];

const ICON_OPTIONS: Array<{ key: string; label: string; icon: React.ReactElement }> = [
  { key: 'team',            label: 'Команда',        icon: <TeamOutlined /> },
  { key: 'desktop',         label: 'Frontend',       icon: <DesktopOutlined /> },
  { key: 'api',             label: 'Backend',        icon: <ApiOutlined /> },
  { key: 'tool',            label: 'DevOps',         icon: <ToolOutlined /> },
  { key: 'experiment',      label: 'QA',             icon: <ExperimentOutlined /> },
  { key: 'mobile',          label: 'Mobile',         icon: <MobileOutlined /> },
  { key: 'bank',            label: 'Core',           icon: <BankOutlined /> },
  { key: 'code',            label: 'Разработка',     icon: <CodeOutlined /> },
  { key: 'cloud',           label: 'Облако',         icon: <CloudOutlined /> },
  { key: 'rocket',          label: 'Релизы',         icon: <RocketOutlined /> },
  { key: 'star',            label: 'VIP',            icon: <StarOutlined /> },
  { key: 'safety',          label: 'Безопасность',   icon: <SafetyOutlined /> },
  { key: 'bar-chart',       label: 'Аналитика',      icon: <BarChartOutlined /> },
  { key: 'database',        label: 'Данные',         icon: <DatabaseOutlined /> },
  { key: 'global',          label: 'Глобальная',     icon: <GlobalOutlined /> },
  { key: 'support',         label: 'Поддержка',      icon: <CustomerServiceOutlined /> },
  { key: 'bug',             label: 'Тестирование',   icon: <BugOutlined /> },
  { key: 'thunder',         label: 'Производит.',    icon: <ThunderboltOutlined /> },
  { key: 'crown',           label: 'Управление',     icon: <CrownOutlined /> },
];

const ICON_BY_KEY: Record<string, React.ReactElement> = Object.fromEntries(
  ICON_OPTIONS.map(o => [o.key, o.icon])
);

const NAME_TO_ICON_KEY: Record<string, string> = {
  Frontend: 'desktop', Backend: 'api', DevOps: 'tool',
  QA: 'experiment', Mobile: 'mobile', Core: 'bank',
};

function loadTeamIconKeys(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem('teamIconKeys') ?? '{}'); } catch { return {}; }
}
function saveTeamIconKey(teamId: string, key: string) {
  const m = loadTeamIconKeys();
  m[teamId] = key;
  localStorage.setItem('teamIconKeys', JSON.stringify(m));
}

const TEAM_ICON_DEFAULT = <TeamOutlined />;
const TEAM_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#6366F1', '#0EA5E9', '#EC4899'];
const teamColor = (name: string): string => {
  let s = 0;
  for (let i = 0; i < name.length; i++) s += name.charCodeAt(i);
  return TEAM_COLORS[s % TEAM_COLORS.length];
};

// ── Shared primitives ───────────────────────────────────────────────────────

const Avatar: React.FC<{ user: { name: string; avatar: string; color: string }; size?: number }> = ({ user, size = 32 }) => (
  <span
    title={user.name}
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 999, width: size, height: size, fontSize: size * 0.38,
      fontWeight: 600, color: '#fff', background: user.color, flexShrink: 0,
      border: '2px solid #fff',
    }}
  >
    {user.avatar}
  </span>
);

const Modal: React.FC<{ title: string; onClose: () => void; width?: number; children: React.ReactNode }> = ({ title, onClose, width = 400, children }) => (
  <div
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    onClick={onClose}
  >
    <div
      style={{ background: '#fff', borderRadius: 12, padding: 28, width, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 18 }}
      onClick={e => e.stopPropagation()}
    >
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--c-gray-900)' }}>{title}</h2>
      {children}
    </div>
  </div>
);

const fieldStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 13, border: '1px solid var(--border-subtle)', borderRadius: 8, outline: 'none', width: '100%', boxSizing: 'border-box', background: '#fff' };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--c-gray-600)' };

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

const ConfirmModal: React.FC<{ title: string; message: string; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void }> = ({ title, message, confirmLabel, danger, busy, onConfirm, onClose }) => (
  <Modal title={title} onClose={onClose} width={380}>
    <p style={{ margin: 0, fontSize: 13, color: 'var(--c-gray-600)', lineHeight: 1.6 }}>{message}</p>
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
      <button className="btn" onClick={onClose} disabled={busy} style={{ padding: '8px 18px', fontSize: 13, border: '1px solid var(--border-subtle)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--c-gray-700)', fontWeight: 500 }}>Отмена</button>
      <button
        className={danger ? 'btn' : 'btn btn--primary'}
        onClick={onConfirm}
        disabled={busy}
        style={danger ? { padding: '8px 18px', fontSize: 13, border: 'none', borderRadius: 8, background: '#DC2626', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: busy ? 0.6 : 1 } : { opacity: busy ? 0.6 : 1 }}
      >
        {busy ? '…' : confirmLabel}
      </button>
    </div>
  </Modal>
);

const RolePill: React.FC<{ role: string }> = ({ role }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: rolePillBg(role), color: rolePillFg(role) }}>
    {ROLE_LABEL[role] ?? role}
  </span>
);

const StateBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: active ? 'rgba(5,150,105,0.12)' : 'rgba(107,114,128,0.14)', color: active ? '#059669' : '#6B7280' }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#059669' : '#9CA3AF' }} />
    {active ? 'Активен' : 'Отключён'}
  </span>
);

const Spinner: React.FC<{ label?: string }> = ({ label = 'Загрузка…' }) => (
  <div style={{ padding: 48, textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>{label}</div>
);

const ErrorBox: React.FC<{ error: unknown; onRetry?: () => void }> = ({ error, onRetry }) => (
  <div style={{ padding: 24, textAlign: 'center', color: '#DC2626', fontSize: 13 }}>
    Ошибка загрузки: {(error as Error)?.message ?? 'неизвестная ошибка'}
    {onRetry && <div style={{ marginTop: 12 }}><button className="btn btn--primary" onClick={onRetry}>Повторить</button></div>}
  </div>
);

const SearchSelect: React.FC<{
  value: string;
  onChange: (id: string) => void;
  options: Array<{ id: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  emptyLabel?: string;
}> = ({ value, onChange, options, placeholder = 'Начните вводить имя…', disabled, emptyLabel = '— Не выбрано —' }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find(o => o.id === value)?.label ?? '';

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(o => {
      const l = o.label.toLowerCase();
      return l.startsWith(q) || l.split(/\s+/).some(w => w.startsWith(q));
    });
  }, [options, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (id: string) => { onChange(id); setQuery(''); setOpen(false); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        style={{ ...fieldStyle, cursor: disabled ? 'not-allowed' : 'text' }}
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => { setQuery(e.target.value); if (!e.target.value) onChange(''); }}
        onFocus={() => { setQuery(''); setOpen(true); }}
      />
      {open && !disabled && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)', maxHeight: 220, overflowY: 'auto', marginTop: 4,
        }}>
          <div onMouseDown={() => select('')} style={{ padding: '8px 12px', fontSize: 13, color: 'var(--c-gray-400)', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}>
            {emptyLabel}
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--c-gray-400)' }}>Ничего не найдено</div>
          ) : filtered.map(o => (
            <div
              key={o.id}
              onMouseDown={() => select(o.id)}
              style={{
                padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                background: o.id === value ? 'rgba(37,99,235,0.08)' : undefined,
                color: o.id === value ? '#2563EB' : 'var(--c-gray-900)',
              }}
            >{o.label}</div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Users ───────────────────────────────────────────────────────────────────

interface UserFormState { name: string; email: string; password: string; role: Role | 'client'; teamId: string }
const emptyUserForm: UserFormState = { name: '', email: '', password: '', role: 'worker', teamId: '' };

const emptyClientForm: UserFormState = { name: '', email: '', password: '', role: 'client', teamId: '' };

const AdminUsers: React.FC = () => {
  const qc = useQueryClient();
  const setToast = useAppStore(s => s.setToast);

  const [tab, setTab] = useState<'staff' | 'clients'>('staff');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyUserForm);
  const [formError, setFormError] = useState('');

  const usersQ = useQuery({ queryKey: ['admin-users'], queryFn: () => getUsers() });
  const teamsQ = useQuery({ queryKey: ['admin-teams'], queryFn: () => getTeams() });

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    (teamsQ.data ?? []).forEach(t => m.set(t.id, t.name));
    return (u: User) => (u.teamId && m.get(u.teamId)) || u.team || '—';
  }, [teamsQ.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-users'] });
    qc.invalidateQueries({ queryKey: ['admin-teams'] });
  };

  const createM = useMutation({
    mutationFn: () => createUser({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role, teamId: form.role === 'client' ? null : (form.teamId || null) }),
    onSuccess: () => { invalidate(); setShowCreate(false); setForm(emptyUserForm); setToast({ kind: 'success', msg: tab === 'clients' ? 'Аккаунт клиента создан' : 'Пользователь создан' }); },
    onError: (e: Error) => setFormError(e.message),
  });

  const updateM = useMutation({
    mutationFn: () => updateUser(editUser!.id, {
      name: form.name.trim(), email: form.email.trim(), role: form.role,
      teamId: form.role === 'client' ? null : (form.teamId || null),
      ...(form.password ? { password: form.password } : {}),
    }),
    onSuccess: () => { invalidate(); setEditUser(null); setForm(emptyUserForm); setToast({ kind: 'success', msg: 'Изменения сохранены' }); },
    onError: (e: Error) => setFormError(e.message),
  });

  const toggleM = useMutation({
    mutationFn: (u: User) => (u.active === false ? setUserActive(u.id, true).then(() => {}) : deactivateUser(u.id)),
    onSuccess: (_d, u) => { invalidate(); setConfirmUser(null); setToast({ kind: 'success', msg: u.active === false ? 'Пользователь активирован' : 'Пользователь отключён' }); },
    onError: (e: Error) => { setConfirmUser(null); setToast({ kind: 'error', msg: e.message }); },
  });

  const openCreate = () => {
    setForm(tab === 'clients' ? emptyClientForm : emptyUserForm);
    setFormError('');
    setShowCreate(true);
  };
  const openEdit = (u: User) => {
    setForm({ name: u.name, email: u.email ?? '', password: '', role: u.role, teamId: u.teamId ?? '' });
    setFormError(''); setEditUser(u);
  };

  const validateForm = (requirePassword: boolean): boolean => {
    if (form.name.trim().length < 2) { setFormError('Имя должно содержать не менее 2 символов'); return false; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { setFormError('Введите корректный email'); return false; }
    if (requirePassword && form.password.length < 8) { setFormError('Пароль должен быть не менее 8 символов'); return false; }
    if (form.password && form.password.length < 8) { setFormError('Пароль должен быть не менее 8 символов'); return false; }
    setFormError('');
    return true;
  };

  const allStaff = (usersQ.data ?? []).filter(u => u.role !== 'client');
  const allClients = (usersQ.data ?? []).filter(u => u.role === 'client');

  const applyFilters = (users: User[]) => users.filter(u => {
    if (tab === 'staff' && roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter === 'active' && u.active === false) return false;
    if (statusFilter === 'inactive' && u.active !== false) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !(u.email ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filtered = applyFilters(tab === 'staff' ? allStaff : allClients);
  const teamOptions = teamsQ.data ?? [];
  const isClient = tab === 'clients' || form.role === 'client';

  const UserFormBody: React.FC<{ mode: 'create' | 'edit'; busy: boolean; onSubmit: () => void; onCancel: () => void }> = ({ mode, busy, onSubmit, onCancel }) => (
    <>
      <Field label="Имя / Название организации *">
        <input className="input" style={fieldStyle} placeholder={isClient ? 'ООО «Компания» или Иван Иванов' : 'Иван Иванов'} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </Field>
      <Field label="Email *">
        <input className="input" type="email" style={fieldStyle} placeholder={isClient ? 'client@company.ru' : 'ivan@company.ru'} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </Field>
      <Field label={mode === 'create' ? 'Пароль *' : 'Новый пароль (необязательно)'}>
        <input className="input" type="password" style={fieldStyle} placeholder="Минимум 8 символов" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
      </Field>
      {tab === 'staff' && (
        <Field label="Роль">
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} style={{ ...fieldStyle, cursor: 'pointer' }}>
            {STAFF_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
      )}
      {tab === 'staff' && (
        <Field label="Команда">
          <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} style={{ ...fieldStyle, cursor: 'pointer' }}>
            <option value="">— Без команды —</option>
            {teamOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      )}
      {formError && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 500 }}>{formError}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="btn" onClick={onCancel} disabled={busy} style={{ padding: '8px 18px', fontSize: 13, border: '1px solid var(--border-subtle)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--c-gray-700)', fontWeight: 500 }}>Отмена</button>
        <button className="btn btn--primary" onClick={onSubmit} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>{busy ? '…' : (mode === 'create' ? 'Создать' : 'Сохранить')}</button>
      </div>
    </>
  );

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', fontSize: 13, fontWeight: active ? 600 : 400,
    border: 'none', borderRadius: 8, cursor: 'pointer',
    background: active ? 'var(--c-blue-500)' : 'transparent',
    color: active ? '#fff' : 'var(--c-gray-600)',
    transition: 'all 0.12s',
  });

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Пользователи</h1>
          <p className="page-sub muted" style={{ margin: '2px 0 0' }}>
            {tab === 'staff' ? `${allStaff.length} сотрудников` : `${allClients.length} клиентов`} · Управление учётными записями
          </p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>
          {tab === 'clients' ? '+ Добавить клиента' : '+ Добавить пользователя'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--border-subtle)' }}>
        <button style={tabBtnStyle(tab === 'staff')} onClick={() => { setTab('staff'); setSearch(''); setRoleFilter('all'); }}>Сотрудники</button>
        <button style={tabBtnStyle(tab === 'clients')} onClick={() => { setTab('clients'); setSearch(''); }}>Клиенты</button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder="Поиск по имени или email..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...fieldStyle, maxWidth: 280 }} />
        {tab === 'staff' && (
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...fieldStyle, width: 'auto', cursor: 'pointer' }}>
            <option value="all">Все роли</option>
            {STAFF_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        )}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={{ ...fieldStyle, width: 'auto', cursor: 'pointer' }}>
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Отключённые</option>
        </select>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {usersQ.isLoading ? <Spinner /> : usersQ.isError ? <ErrorBox error={usersQ.error} onRetry={usersQ.refetch} /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {(tab === 'staff'
                  ? ['Пользователь', 'Роль', 'Команда', 'Статус', '']
                  : ['Клиент', 'Email', 'Статус', '']
                ).map((h, i) => (
                  <th key={i} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>
                  {tab === 'clients' ? 'Клиенты не найдены' : 'Пользователи не найдены'}
                </td></tr>
              ) : filtered.map((user, i) => (
                <tr key={user.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', opacity: user.active === false ? 0.6 : 1 }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar user={user} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-gray-900)' }}>{user.name}</div>
                        {tab === 'staff' && <div style={{ fontSize: 11, color: 'var(--c-gray-500)' }}>{user.email ?? '—'}</div>}
                      </div>
                    </div>
                  </td>
                  {tab === 'staff' && <td style={{ padding: '12px 16px' }}><RolePill role={user.role} /></td>}
                  {tab === 'staff' && <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--c-gray-600)' }}>{teamName(user)}</td>}
                  {tab === 'clients' && <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--c-gray-500)' }}>{user.email ?? '—'}</td>}
                  <td style={{ padding: '12px 16px' }}><StateBadge active={user.active !== false} /></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEdit(user)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--c-gray-700)', marginRight: 6 }}>Изменить</button>
                    <button onClick={() => setConfirmUser(user)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: user.active === false ? '#059669' : '#DC2626' }}>
                      {user.active === false ? 'Включить' : 'Отключить'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <Modal title={tab === 'clients' ? 'Новый клиент' : 'Новый пользователь'} onClose={() => setShowCreate(false)}>
          <UserFormBody mode="create" busy={createM.isPending} onCancel={() => setShowCreate(false)} onSubmit={() => { if (validateForm(true)) createM.mutate(); }} />
        </Modal>
      )}

      {editUser && (
        <Modal title="Редактирование пользователя" onClose={() => setEditUser(null)}>
          <UserFormBody mode="edit" busy={updateM.isPending} onCancel={() => setEditUser(null)} onSubmit={() => { if (validateForm(false)) updateM.mutate(); }} />
        </Modal>
      )}

      {confirmUser && (
        <ConfirmModal
          title={confirmUser.active === false ? 'Активировать пользователя' : 'Отключить пользователя'}
          message={confirmUser.active === false
            ? `Восстановить доступ для «${confirmUser.name}»?`
            : `Пользователь «${confirmUser.name}» потеряет доступ к системе. Учётная запись будет деактивирована.`}
          confirmLabel={confirmUser.active === false ? 'Активировать' : 'Отключить'}
          danger={confirmUser.active !== false}
          busy={toggleM.isPending}
          onConfirm={() => toggleM.mutate(confirmUser)}
          onClose={() => setConfirmUser(null)}
        />
      )}
    </div>
  );
};

// ── Teams ───────────────────────────────────────────────────────────────────

interface TeamFormState { name: string; teamleadId: string; iconKey: string }

const AdminTeams: React.FC = () => {
  const qc = useQueryClient();
  const setToast = useAppStore(s => s.setToast);

  const [showCreate, setShowCreate] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [confirmTeam, setConfirmTeam] = useState<TeamDetail | null>(null);
  const [form, setForm] = useState<TeamFormState>({ name: '', teamleadId: '', iconKey: 'team' });
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [addMemberId, setAddMemberId] = useState('');
  const [teamIconKeys, setTeamIconKeys] = useState<Record<string, string>>(() => loadTeamIconKeys());

  const teamsQ = useQuery({ queryKey: ['admin-teams'], queryFn: () => getTeams() });
  const usersQ = useQuery({ queryKey: ['admin-users'], queryFn: () => getUsers() });

  const leadCandidates = (usersQ.data ?? []).filter(u => u.role !== 'client' && u.active !== false);

  // Live editing team — auto-updates after invalidation
  const editingTeam = editingTeamId ? (teamsQ.data?.find(t => t.id === editingTeamId) ?? null) : null;
  const currentMemberIds = useMemo(() => new Set(editingTeam?.members.map(m => m.id) ?? []), [editingTeam]);
  const availableToAdd = useMemo(
    () => (usersQ.data ?? []).filter(u => u.role !== 'client' && u.active !== false && !currentMemberIds.has(u.id)),
    [usersQ.data, currentMemberIds],
  );

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (teamsQ.data ?? []).filter(t => !q || t.name.toLowerCase().includes(q));
  }, [teamsQ.data, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-teams'] });
    qc.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const createM = useMutation({
    mutationFn: () => createTeam({ name: form.name.trim(), teamleadId: form.teamleadId || null }),
    onSuccess: (created) => {
      saveTeamIconKey(created.id, form.iconKey);
      setTeamIconKeys(loadTeamIconKeys());
      invalidate(); setShowCreate(false); setForm({ name: '', teamleadId: '', iconKey: 'team' }); setToast({ kind: 'success', msg: 'Команда создана' });
    },
    onError: (e: Error) => setFormError(e.message),
  });
  const updateM = useMutation({
    mutationFn: () => updateTeam(editingTeamId!, { name: form.name.trim(), teamleadId: form.teamleadId || null }),
    onSuccess: () => {
      saveTeamIconKey(editingTeamId!, form.iconKey);
      setTeamIconKeys(loadTeamIconKeys());
      invalidate(); setToast({ kind: 'success', msg: 'Команда обновлена' });
    },
    onError: (e: Error) => setFormError(e.message),
  });
  const deleteM = useMutation({
    mutationFn: () => deleteTeam(confirmTeam!.id),
    onSuccess: () => { invalidate(); setConfirmTeam(null); setToast({ kind: 'success', msg: 'Команда удалена' }); },
    onError: (e: Error) => { setConfirmTeam(null); setToast({ kind: 'error', msg: e.message }); },
  });
  const addMemberM = useMutation({
    mutationFn: (userId: string) => updateUser(userId, { teamId: editingTeamId! }),
    onSuccess: () => { invalidate(); setAddMemberId(''); setToast({ kind: 'success', msg: 'Участник добавлен' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });
  const removeMemberM = useMutation({
    mutationFn: (userId: string) => updateUser(userId, { teamId: null }),
    onSuccess: () => { invalidate(); setToast({ kind: 'success', msg: 'Участник удалён из команды' }); },
    onError: (e: Error) => setToast({ kind: 'error', msg: e.message }),
  });

  const closeEdit = () => { setEditingTeamId(null); setAddMemberId(''); setFormError(''); };
  const openCreate = () => { setForm({ name: '', teamleadId: '', iconKey: 'team' }); setFormError(''); setShowCreate(true); };
  const openEdit = (t: TeamDetail) => {
    const saved = loadTeamIconKeys();
    const iconKey = saved[t.id] ?? NAME_TO_ICON_KEY[t.name] ?? 'team';
    setForm({ name: t.name, teamleadId: t.teamleadId ?? '', iconKey });
    setFormError(''); setEditingTeamId(t.id);
  };
  const submit = (fn: () => void) => { if (form.name.trim().length < 2) { setFormError('Название должно содержать не менее 2 символов'); return; } setFormError(''); fn(); };

  const TeamFormBody: React.FC<{ mode: 'create' | 'edit'; busy: boolean; onSubmit: () => void; onCancel: () => void }> = ({ mode, busy, onSubmit, onCancel }) => (
    <>
      <Field label="Название команды *"><input className="input" style={fieldStyle} placeholder="Например: Design" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
      <Field label="Иконка">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ICON_OPTIONS.map(o => (
            <button
              key={o.key}
              type="button"
              title={o.label}
              onClick={() => setForm(f => ({ ...f, iconKey: o.key }))}
              style={{
                width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                border: form.iconKey === o.key ? '2px solid #2563EB' : '1px solid var(--border-subtle)',
                background: form.iconKey === o.key ? '#EFF6FF' : 'var(--bg-surface)',
                color: form.iconKey === o.key ? '#2563EB' : 'var(--c-gray-500)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                transition: 'border-color 0.12s, background 0.12s',
              }}
            >
              {o.icon}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Руководитель">
        <SearchSelect
          value={form.teamleadId}
          onChange={id => setForm(f => ({ ...f, teamleadId: id }))}
          options={leadCandidates.map(u => ({ id: u.id, label: `${u.name} (${ROLE_LABEL[u.role]})` }))}
          placeholder="Начните вводить имя…"
          emptyLabel="— Не назначен —"
        />
      </Field>

      {mode === 'edit' && editingTeam && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-gray-600)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Состав команды</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <SearchSelect
                value={addMemberId}
                onChange={setAddMemberId}
                options={availableToAdd.map(u => ({ id: u.id, label: `${u.name} (${ROLE_LABEL[u.role]})` }))}
                placeholder="Начните вводить имя…"
                emptyLabel="— Выберите участника —"
                disabled={addMemberM.isPending}
              />
            </div>
            <button
              className="btn btn--primary"
              onClick={() => addMemberId && addMemberM.mutate(addMemberId)}
              disabled={!addMemberId || addMemberM.isPending}
              style={{ padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap', opacity: (!addMemberId || addMemberM.isPending) ? 0.5 : 1 }}
            >
              {addMemberM.isPending ? '…' : 'Добавить'}
            </button>
          </div>
          {editingTeam.members.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--c-gray-400)', padding: '6px 0' }}>Нет участников</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
              {editingTeam.members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, background: 'var(--bg-surface)' }}>
                  <Avatar user={m} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-gray-500)' }}>{ROLE_LABEL[m.role]}</div>
                  </div>
                  <button
                    onClick={() => removeMemberM.mutate(m.id)}
                    disabled={removeMemberM.isPending}
                    title="Удалить из команды"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: removeMemberM.isPending ? 0.4 : 1 }}
                  ><CloseOutlined /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {formError && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 500 }}>{formError}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onCancel} disabled={busy} style={{ padding: '8px 18px', fontSize: 13, border: '1px solid var(--border-subtle)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--c-gray-700)', fontWeight: 500 }}>
          {mode === 'edit' ? 'Закрыть' : 'Отмена'}
        </button>
        <button className="btn btn--primary" onClick={onSubmit} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>{busy ? '…' : (mode === 'create' ? 'Создать' : 'Сохранить')}</button>
      </div>
    </>
  );

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Команды</h1>
          <p className="page-sub muted" style={{ margin: '2px 0 0' }}>{teamsQ.data?.length ?? 0} команд · Структура подразделений</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>+ Добавить команду</button>
      </div>

      <input className="input" placeholder="Поиск по названию..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...fieldStyle, maxWidth: 320 }} />

      {teamsQ.isLoading ? <Spinner /> : teamsQ.isError ? <ErrorBox error={teamsQ.error} onRetry={teamsQ.refetch} /> : filteredTeams.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>
          {search.trim() ? `Команд с названием «${search.trim()}» не найдено` : (
            <>
              <div style={{ fontSize: 32, marginBottom: 12 }}><TeamOutlined /></div>
              <div style={{ fontWeight: 600, color: 'var(--c-gray-700)', marginBottom: 6 }}>Команды ещё не созданы</div>
              <div>Нажмите «+ Добавить команду» чтобы начать</div>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filteredTeams.map(team => {
            const color = teamColor(team.name);
            const iconKey = teamIconKeys[team.id] ?? NAME_TO_ICON_KEY[team.name] ?? 'team';
            const icon = ICON_BY_KEY[iconKey] ?? TEAM_ICON_DEFAULT;
            return (
              <div key={team.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ height: 6, background: color }} />
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-gray-900)' }}>{team.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--c-gray-500)' }}>{team.members.length} {team.members.length === 1 ? 'участник' : team.members.length < 5 ? 'участника' : 'участников'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(team)} title="Изменить" style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--c-gray-600)' }}><EditOutlined /></button>
                      <button onClick={() => setConfirmTeam(team)} title="Удалить" style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: 'pointer', color: '#DC2626' }}><DeleteOutlined /></button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--c-gray-500)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Руководитель</div>
                    {team.teamleadName ? (
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{team.teamleadName}</span>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--c-gray-400)' }}>Не назначен</span>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--c-gray-500)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Состав</div>
                    {team.members.length === 0 ? (
                      <button
                        onClick={() => openEdit(team)}
                        style={{ fontSize: 12, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                      >
                        Добавить участников
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        {team.members.slice(0, 8).map(m => <Avatar key={m.id} user={m} size={26} />)}
                        {team.members.length > 8 && <span style={{ fontSize: 12, color: 'var(--c-gray-500)' }}>+{team.members.length - 8}</span>}
                        <button
                          onClick={() => openEdit(team)}
                          title="Управление составом"
                          style={{ fontSize: 12, color: 'var(--c-gray-400)', background: 'none', border: '1px dashed var(--border-subtle)', borderRadius: 999, width: 26, height: 26, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >+</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal title="Новая команда" onClose={() => setShowCreate(false)} width={380}>
          <TeamFormBody mode="create" busy={createM.isPending} onCancel={() => setShowCreate(false)} onSubmit={() => submit(() => createM.mutate())} />
        </Modal>
      )}
      {editingTeamId && (
        <Modal title={`Команда: ${editingTeam?.name ?? '…'}`} onClose={closeEdit} width={480}>
          <TeamFormBody mode="edit" busy={updateM.isPending} onCancel={closeEdit} onSubmit={() => submit(() => updateM.mutate())} />
        </Modal>
      )}
      {confirmTeam && (
        <ConfirmModal
          title="Удалить команду"
          message={`Команда «${confirmTeam.name}» будет удалена. Участники останутся в системе без команды.`}
          confirmLabel="Удалить"
          danger
          busy={deleteM.isPending}
          onConfirm={() => deleteM.mutate()}
          onClose={() => setConfirmTeam(null)}
        />
      )}
    </div>
  );
};

// ── Audit log ───────────────────────────────────────────────────────────────

const KIND_OPTIONS = ['all', 'create', 'update', 'delete', 'login'] as const;
const KIND_LABELS: Record<string, string> = { all: 'Все действия', create: 'Создание', update: 'Изменение', delete: 'Удаление', login: 'Вход' };
const KIND_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  create: { bg: 'rgba(5,150,105,0.12)', fg: '#059669', label: 'Создание' },
  update: { bg: 'rgba(37,99,235,0.12)', fg: '#2563EB', label: 'Изменение' },
  delete: { bg: 'rgba(220,38,38,0.12)', fg: '#DC2626', label: 'Удаление' },
  login: { bg: 'rgba(124,58,237,0.12)', fg: '#7C3AED', label: 'Вход' },
};

const AdminAudit: React.FC = () => {
  const [kindFilter, setKindFilter] = useState<string>('all');
  const auditQ = useQuery({ queryKey: ['admin-audit'], queryFn: () => getAuditLog() });

  const sorted = useMemo<AuditEntry[]>(() =>
    [...(auditQ.data ?? [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [auditQ.data]);
  const entries = kindFilter === 'all' ? sorted : sorted.filter(e => e.kind === kindFilter);

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Журнал аудита</h1>
          <p className="page-sub muted" style={{ margin: '2px 0 0' }}>{sorted.length} записей · Все действия пользователей в системе</p>
        </div>
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value)} style={{ ...fieldStyle, width: 'auto', cursor: 'pointer' }}>
          {KIND_OPTIONS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {auditQ.isLoading ? <Spinner /> : auditQ.isError ? <ErrorBox error={auditQ.error} onRetry={auditQ.refetch} /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Время', 'Пользователь', 'Действие', 'Объект', 'Тип'].map((h, i) => (
                  <th key={i} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--c-gray-500)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 13 }}>Записей нет</td></tr>
              ) : entries.map((row, i) => {
                const badge = KIND_BADGE[row.kind];
                return (
                  <tr key={row.id} style={{ borderBottom: i < entries.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--c-gray-500)', whiteSpace: 'nowrap' }}>
                        {new Date(row.timestamp).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>{row.user}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--c-gray-700)' }}>{row.action}</td>
                    <td style={{ padding: '10px 16px' }}><span className="mono" style={{ fontSize: 12, color: '#2563EB', fontWeight: 600 }}>{row.target}</span></td>
                    <td style={{ padding: '10px 16px' }}>
                      {badge ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.fg }}>{badge.label}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--c-gray-500)' }}>{row.kind}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export const AdminScreen: React.FC<Props> = ({ subscreen }) => {
  if (subscreen === 'users') return <AdminUsers />;
  if (subscreen === 'teams') return <AdminTeams />;
  return <AdminAudit />;
};
