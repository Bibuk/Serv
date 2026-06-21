import React, { useState, useMemo, useEffect } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { useAppStore } from '../../store/appStore';
import { createTicket } from '../../api';
import type { Priority } from '../../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  communications:  'Коммуникации',
  networks:        'Сети',
  access:          'Учётные записи и доступы',
  office:          'Офис и периферия',
  logistics:       'Логистика — складской учёт',
  finance:         'Финансы — бухгалтерия',
  sales:           'Продажи — CRM',
  infrastructure:  'Инфраструктура',
  business_apps:   'Бизнес-приложения',
};

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'critical', label: 'Критичный — работа остановлена' },
  { value: 'high',     label: 'Высокий' },
  { value: 'medium',   label: 'Средний' },
  { value: 'low',      label: 'Низкий' },
];

const AFFECTED_OPTIONS = [
  { value: 'me',         label: 'Только я' },
  { value: 'department', label: 'Отдел' },
  { value: 'branch',     label: 'Весь склад / филиал' },
];

const BRANCHES = [
  // Москва и МО
  'Москва — Головной офис (ул. Авиаконструктора Миля, 10)',
  'Москва — Производственный комплекс Зеленоград',
  'МО, Подольск — Склад №1 (ул. Машиностроителей, 15)',
  'МО, Химки — Склад №2 (Ленинградское ш., 71)',
  'МО, Домодедово — Склад №3 (Промышленный пр., 4)',
  // Северо-Запад
  'Санкт-Петербург — Офис (Лиговский пр., 87)',
  'Санкт-Петербург — Склад (Колпино, ул. Загородная, 22)',
  // Урал
  'Екатеринбург — Региональный офис (ул. Луначарского, 81)',
  'Екатеринбург — Склад (ул. Монтажников, 28)',
  // Сибирь
  'Новосибирск — Региональный офис (ул. Советская, 64)',
  'Новосибирск — Склад (ул. Большая, 243)',
  'Красноярск — Офис (ул. Маерчака, 18)',
  // Поволжье
  'Казань — Региональный офис (ул. Профсоюзная, 17)',
  'Нижний Новгород — Офис (ул. Студенческая, 4)',
  'Самара — Офис (ул. Ново-Садовая, 106)',
  'Саратов — Офис (ул. Рабочая, 22)',
  'Уфа — Офис (ул. Менделеева, 132)',
  'Волгоград — Офис (пр. Ленина, 55)',
  'Пермь — Офис (ул. Революции, 13)',
  // Юг
  'Краснодар — Региональный офис и склад (ул. Тополиная аллея, 9)',
  'Ростов-на-Дону — Офис (пр. Шолохова, 47)',
  'Воронеж — Офис (ул. Театральная, 23)',
];

const TICKET_STATUS_LABELS: Record<string, string> = {
  new:      'Новый',
  accepted: 'Принят',
  inprog:   'В работе',
  closed:   'Закрыт',
  rejected: 'Отклонён',
};

const DRAFT_KEY = 'ticket_draft_v1';

const fmtSla = (hours: number) => {
  if (hours < 1) return `${Math.round(hours * 60)} мин`;
  return `${hours} ч`;
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const fieldWrap: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 6 };
const labelCss: React.CSSProperties   = { fontSize: 13, fontWeight: 600, color: 'var(--c-gray-700)' };
const inputCss: React.CSSProperties   = {
  width: '100%', padding: '9px 12px',
  border: '1px solid var(--border-subtle)', borderRadius: 8,
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', background: 'var(--bg-surface)', color: 'var(--c-gray-900)',
};
const errCss: React.CSSProperties = { color: '#f87171', fontSize: 12, marginTop: 4 };

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  goto:     (screen: string) => void;
  onSubmit: (data: Record<string, string>) => void;
  mobile:   boolean;
}

export const ClientCreateTicket: React.FC<Props> = ({ goto, onSubmit, mobile }) => {
  const addTicket   = useAppStore(s => s.addTicket);
  const tickets     = useAppStore(s => s.tickets);
  const currentUser = useAppStore(s => s.currentUser);
  const services    = useAppStore(s => s.services);
  const apps        = useAppStore(s => s.apps);

  // ─── Form state ────────────────────────────────────────────────────────────
  const [categoryId,    setCategoryId]    = useState('');
  const [appId,         setAppId]         = useState('');
  const [branch,        setBranch]        = useState('');
  const [title,         setTitle]         = useState('');
  const [desc,          setDesc]          = useState('');
  const [priority,      setPriority]      = useState<Priority | ''>('');
  const [affectedUsers, setAffectedUsers] = useState('');
  const [fileNames,     setFileNames]     = useState<string[]>([]);
  const [fieldErrors,   setFieldErrors]   = useState<Record<string, string>>({});
  const [apiError,      setApiError]      = useState<string | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [draftNotice,   setDraftNotice]   = useState(false);
  const [draftSaved,    setDraftSaved]    = useState(false);

  // Restore draft on mount
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as Record<string, string>;
      if (d.categoryId)    setCategoryId(d.categoryId);
      if (d.appId)         setAppId(d.appId);
      if (d.branch)        setBranch(d.branch);
      if (d.title)         setTitle(d.title);
      if (d.desc)          setDesc(d.desc);
      if (d.priority)      setPriority(d.priority as Priority);
      if (d.affectedUsers) setAffectedUsers(d.affectedUsers);
      setDraftNotice(true);
    } catch {
      // ignore malformed draft
    }
  }, []);

  // ─── Derived data ──────────────────────────────────────────────────────────

  const activeServices = useMemo(() => services.filter(s => s.status !== 'archived'), [services]);
  const activeApps     = useMemo(() => apps.filter(a => a.status === 'active'),       [apps]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    activeServices.forEach(s => { if (s.category) seen.add(s.category); });
    return Array.from(seen);
  }, [activeServices]);

  const servicesInCategory = useMemo(
    () => categoryId ? activeServices.filter(s => s.category === categoryId) : [],
    [activeServices, categoryId],
  );

  const serviceIdSet = useMemo(
    () => new Set(servicesInCategory.map(s => s.id)),
    [servicesInCategory],
  );

  const appsInCategory = useMemo(
    () => activeApps.filter(a => a.services.some(sId => serviceIdSet.has(sId))),
    [activeApps, serviceIdSet],
  );

  // Group apps under their services for <optgroup>
  const appsByService = useMemo(() =>
    servicesInCategory
      .map(svc => ({
        serviceId:   svc.id,
        serviceName: svc.name,
        apps:        appsInCategory.filter(a => a.services.includes(svc.id)),
      }))
      .filter(g => g.apps.length > 0),
    [servicesInCategory, appsInCategory],
  );

  const selectedApp   = useMemo(() => activeApps.find(a => a.id === appId) ?? null, [activeApps, appId]);
  const serviceForApp = useMemo(
    () => selectedApp ? (servicesInCategory.find(s => selectedApp.services.includes(s.id)) ?? null) : null,
    [selectedApp, servicesInCategory],
  );

  // Similar closed/rejected tickets for the selected app
  const similarTickets = useMemo(() =>
    appId
      ? tickets
          .filter(t => t.app === appId && (t.status === 'closed' || t.status === 'rejected'))
          .slice(0, 3)
      : [],
    [tickets, appId],
  );

  // Current user's recent tickets
  const myRecentTickets = useMemo(() =>
    currentUser
      ? [...tickets]
          .filter(t => t.client === currentUser.id)
          .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
          .slice(0, 5)
      : [],
    [tickets, currentUser],
  );

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryId(e.target.value);
    setAppId('');
    setFieldErrors(prev => ({ ...prev, category: '', app: '' }));
  };

  const handleAppChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAppId(e.target.value);
    setFieldErrors(prev => ({ ...prev, app: '' }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFileNames(prev => [...prev, ...Array.from(e.target.files!).map(f => f.name)]);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setFileNames(prev => [...prev, ...Array.from(e.dataTransfer.files).map(f => f.name)]);
  };

  const removeFile = (index: number) => setFileNames(prev => prev.filter((_, i) => i !== index));

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!categoryId)          errors.category = 'Выберите категорию';
    if (!appId)               errors.app      = 'Выберите сервис или приложение';
    if (!branch.trim())       errors.branch   = 'Укажите склад или филиал';
    if (!title.trim() || title.trim().length < 5 || title.trim().length > 200)
      errors.title = 'Введите тему (минимум 5 символов)';
    if (!desc.trim() || desc.trim().length < 10 || desc.trim().length > 2000)
      errors.desc = 'Опишите проблему подробнее (минимум 10 символов)';
    if (!priority)            errors.priority = 'Выберите приоритет';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveDraft = () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      categoryId, appId, branch, title, desc,
      priority: priority ?? '',
      affectedUsers,
      savedAt: new Date().toISOString(),
    }));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2500);
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);
    try {
      const ticket = await createTicket({
        title:       title.trim(),
        desc:        desc.trim(),
        appId,
        priority:    priority as Priority,
        attachments: fileNames,
      });
      addTicket(ticket);
      localStorage.removeItem(DRAFT_KEY);
      onSubmit({ title, desc, appId, priority: priority ?? '', branch, affectedUsers });
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Shared style helpers ──────────────────────────────────────────────────

  const selectCss = (value: string, disabled?: boolean): React.CSSProperties => ({
    ...inputCss,
    color:   value ? 'var(--c-gray-900)' : 'var(--c-gray-400)',
    cursor:  disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  });

  const statusPill = (status: string) => {
    const closed   = status === 'closed';
    const rejected = status === 'rejected';
    return {
      padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' as const,
      background: closed ? '#DCFCE7' : rejected ? '#FEE2E2' : '#DBEAFE',
      color:      closed ? '#166534' : rejected ? '#991B1B' : '#1E40AF',
    };
  };

  // ─── Sub-views ────────────────────────────────────────────────────────────

  const formCard = (
    <div className="card">
      <div className="card__body" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Draft restore notice */}
        {draftNotice && (
          <div style={{
            padding: '10px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE',
            borderRadius: 8, fontSize: 13, color: '#1D4ED8',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>Восстановлен черновик заявки</span>
            <button type="button" onClick={() => setDraftNotice(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D4ED8', padding: '0 4px' }}>
              <CloseOutlined />
            </button>
          </div>
        )}

        {/* 1. Category */}
        <div style={fieldWrap}>
          <label style={labelCss}>Категория <span style={{ color: '#DC2626' }}>*</span></label>
          <select value={categoryId} onChange={handleCategoryChange} style={selectCss(categoryId)}>
            <option value="">Выберите категорию...</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat] ?? cat}</option>
            ))}
          </select>
          {fieldErrors.category && <div style={errCss}>{fieldErrors.category}</div>}
        </div>

        {/* 2. Service / App */}
        <div style={fieldWrap}>
          <label style={labelCss}>Сервис / приложение <span style={{ color: '#DC2626' }}>*</span></label>
          <select
            value={appId}
            onChange={handleAppChange}
            disabled={!categoryId}
            style={selectCss(appId, !categoryId)}
          >
            <option value="">
              {categoryId ? 'Выберите сервис / приложение...' : 'Сначала выберите категорию'}
            </option>
            {appsByService.map(group => (
              <optgroup key={group.serviceId} label={group.serviceName}>
                {group.apps.map(app => (
                  <option key={app.id} value={app.id}>{app.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {fieldErrors.app && <div style={errCss}>{fieldErrors.app}</div>}
        </div>

        {/* 3. Routing info block — appears after service/app selection */}
        {serviceForApp && (
          <div style={{
            padding: '12px 16px', background: '#F0FDF4',
            border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13,
          }}>
            <div style={{ fontWeight: 600, color: '#15803D', marginBottom: 6 }}>Маршрутизация и SLA</div>
            <div style={{ color: '#166534', lineHeight: 1.7 }}>
              <div>
                <span style={{ color: '#4B5563' }}>Ответственная группа: </span>
                <strong>{serviceForApp.responsibleTeam ?? 'не указана'}</strong>
              </div>
              {serviceForApp.sla && (
                <div>
                  <span style={{ color: '#4B5563' }}>Норматив реакции: </span>
                  <strong>{fmtSla(serviceForApp.sla.reaction)}</strong>
                  <span style={{ color: '#4B5563' }}>, решения: </span>
                  <strong>{fmtSla(serviceForApp.sla.resolution)}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Branch / Warehouse */}
        <div style={fieldWrap}>
          <label style={labelCss}>Склад / филиал <span style={{ color: '#DC2626' }}>*</span></label>
          <input
            type="text"
            list="branch-options"
            placeholder="Начните вводить название..."
            value={branch}
            onChange={e => { setBranch(e.target.value); setFieldErrors(p => ({ ...p, branch: '' })); }}
            style={inputCss}
          />
          <datalist id="branch-options">
            {BRANCHES.map(b => <option key={b} value={b} />)}
          </datalist>
          {fieldErrors.branch && <div style={errCss}>{fieldErrors.branch}</div>}
        </div>

        {/* 5. Subject */}
        <div style={fieldWrap}>
          <label style={labelCss}>Тема обращения <span style={{ color: '#DC2626' }}>*</span></label>
          <input
            type="text"
            placeholder="Кратко опишите суть проблемы..."
            value={title}
            onChange={e => { setTitle(e.target.value); setFieldErrors(p => ({ ...p, title: '' })); }}
            style={inputCss}
          />
          {fieldErrors.title && <div style={errCss}>{fieldErrors.title}</div>}
        </div>

        {/* 6. Description */}
        <div style={fieldWrap}>
          <label style={labelCss}>Подробное описание <span style={{ color: '#DC2626' }}>*</span></label>
          <textarea
            placeholder="Что произошло, когда началось, какие действия уже предпринимались..."
            value={desc}
            onChange={e => { setDesc(e.target.value); setFieldErrors(p => ({ ...p, desc: '' })); }}
            rows={5}
            style={{ ...inputCss, resize: 'vertical', minHeight: 100 }}
          />
          {fieldErrors.desc && <div style={errCss}>{fieldErrors.desc}</div>}
        </div>

        {/* 7. Priority */}
        <div style={fieldWrap}>
          <label style={labelCss}>Приоритет <span style={{ color: '#DC2626' }}>*</span></label>
          <select
            value={priority}
            onChange={e => { setPriority(e.target.value as Priority); setFieldErrors(p => ({ ...p, priority: '' })); }}
            style={selectCss(priority)}
          >
            <option value="">Выберите приоритет...</option>
            {PRIORITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {fieldErrors.priority && <div style={errCss}>{fieldErrors.priority}</div>}
        </div>

        {/* 8. Affected users */}
        <div style={fieldWrap}>
          <label style={labelCss}>Затронуто пользователей</label>
          <select
            value={affectedUsers}
            onChange={e => setAffectedUsers(e.target.value)}
            style={selectCss(affectedUsers)}
          >
            <option value="">Не указано (рекомендуется заполнить)</option>
            {AFFECTED_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* 9. Attachments */}
        <div style={fieldWrap}>
          <label style={labelCss}>Вложения</label>
          <label
            htmlFor="file-upload"
            onDragOver={e => e.preventDefault()}
            onDrop={handleFileDrop}
            style={{
              border: '2px dashed var(--border-subtle)', borderRadius: 10,
              padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
              color: 'var(--c-gray-400)', fontSize: 13,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 28 }}>📎</span>
            <span>Перетащите файлы или <span style={{ color: '#2563EB', fontWeight: 500 }}>нажмите для загрузки</span></span>
            <span style={{ fontSize: 11 }}>PNG, JPG, PDF, ZIP — до 20 МБ</span>
            <input id="file-upload" type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
          </label>
          {fileNames.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {fileNames.map((name, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px', background: 'var(--c-gray-50, #F9FAFB)',
                  border: '1px solid var(--border-subtle)', borderRadius: 6,
                  fontSize: 13, color: 'var(--c-gray-700)',
                }}>
                  <span>📄 {name}</span>
                  <button type="button" onClick={() => removeFile(i)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: 'var(--c-gray-400)', padding: '0 2px', lineHeight: 1,
                  }}>
                    <CloseOutlined />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const auxPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Block 1: Similar tickets */}
      <div className="card">
        <div className="card__body" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-gray-800)', marginBottom: 10 }}>
            Похожие обращения
          </div>
          {!appId ? (
            <p style={{ fontSize: 13, color: 'var(--c-gray-400)', margin: 0 }}>
              Выберите сервис / приложение для поиска похожих обращений
            </p>
          ) : similarTickets.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--c-gray-400)', margin: 0 }}>
              Нет закрытых обращений по этому сервису
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {similarTickets.map(t => (
                <div key={t.id} style={{
                  padding: '10px 12px', border: '1px solid var(--border-subtle)',
                  borderRadius: 8, background: 'var(--bg-surface)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-gray-800)', marginBottom: 6, lineHeight: 1.4 }}>
                    {t.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={statusPill(t.status)}>{TICKET_STATUS_LABELS[t.status] ?? t.status}</span>
                    <span style={{ color: 'var(--c-gray-400)' }}>{t.updated}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Block 2: Contextual hint */}
      {appId && (
        <div className="card">
          <div className="card__body" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-gray-800)', marginBottom: 8 }}>
              Что проверить перед отправкой
            </div>
            {serviceForApp?.description ? (
              <p style={{ fontSize: 13, color: 'var(--c-gray-600)', margin: 0, lineHeight: 1.55 }}>
                {serviceForApp.description}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--c-gray-400)', margin: 0 }}>
                Подсказка для этого сервиса не настроена
              </p>
            )}
          </div>
        </div>
      )}

      {/* Block 3: My recent tickets */}
      <div className="card">
        <div className="card__body" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-gray-800)', marginBottom: 10 }}>
            Мои последние заявки
          </div>
          {myRecentTickets.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--c-gray-400)', margin: 0 }}>
              У вас ещё нет обращений
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myRecentTickets.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--c-gray-700)', flex: 1, lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--c-gray-400)', fontSize: 11, marginRight: 4 }}>{t.id}</span>
                    {t.title}
                  </div>
                  <span style={statusPill(t.status)}>{TICKET_STATUS_LABELS[t.status] ?? t.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: mobile ? 16 : '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Back */}
      <button
        onClick={() => goto('tickets')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, color: '#2563EB', fontWeight: 500,
          padding: 0, display: 'flex', alignItems: 'center', gap: 4,
          alignSelf: 'flex-start',
        }}
      >
        ← Назад
      </button>

      {/* Title */}
      <div>
        <h1 style={{ margin: 0, fontSize: mobile ? 20 : 24, fontWeight: 700, color: 'var(--c-gray-900)' }}>
          Новая заявка
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--c-gray-500)' }}>
          Опишите проблему как можно подробнее — это поможет нам быстрее её решить
        </p>
      </div>

      {/* Two-column layout (stacks on mobile) */}
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 20, alignItems: 'flex-start' }}>

        {/* Left: form + error + buttons */}
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {formCard}

          {apiError && (
            <div style={{
              color: '#DC2626', fontSize: 13, padding: '8px 12px',
              background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 8,
            }}>
              {apiError}
            </div>
          )}

          {/* 10. Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn--outline" onClick={handleSaveDraft}>
              {draftSaved ? '✓ Черновик сохранён' : 'Сохранить как черновик'}
            </button>
            <button
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Отправка…' : 'Отправить заявку →'}
            </button>
          </div>
        </div>

        {/* Right: auxiliary panel */}
        <div style={{ width: mobile ? '100%' : 320, flexShrink: 0 }}>
          {auxPanel}
        </div>
      </div>
    </div>
  );
};
