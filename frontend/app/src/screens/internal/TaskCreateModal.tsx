import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SidebarIcon } from '../../shells';
import { useAppStore } from '../../store/appStore';
import { useAutosave } from '../../hooks/useAutosave';
import type { Priority, Task, Ticket, TaskPrefill } from '../../types';
import { createTask, updateTask, assignTask, getServices, getTeams, linkTaskToTicket } from '../../api';
import { clampPriority } from '../../utils/serviceMeta';

interface Props {
  onClose: () => void;
  onSubmit: (task: Task, linkedTicket?: Ticket) => void;
  prefill?: TaskPrefill | null;
}

interface FormState {
  title: string;
  desc: string;
  service: string;
  team: string;
  priority: string;
  deadline: string;
  ticket: string;
}

const PRIORITY_OPTIONS = [
  { value: 'high',   label: 'Высокий' },
  { value: 'medium', label: 'Средний' },
  { value: 'low',    label: 'Низкий' },
];

export const TaskCreateModal: React.FC<Props> = ({ onClose, onSubmit, prefill }) => {
  const addTask = useAppStore(s => s.addTask);
  const setTasks = useAppStore(s => s.setTasks);
  const tickets = useAppStore(s => s.tickets);

  const servicesQ = useQuery({ queryKey: ['services'], queryFn: () => getServices() });
  const teamsQ = useQuery({ queryKey: ['teams'], queryFn: () => getTeams() });

  const services = React.useMemo(() => servicesQ.data ?? [], [servicesQ.data]);
  const teams = React.useMemo(() => teamsQ.data ?? [], [teamsQ.data]);
  const openTickets = tickets.filter(t => !['closed', 'rejected'].includes(t.status));

  const fromTicket = !!prefill?.ticketId;
  const sourceTicket = prefill?.ticketId ? tickets.find(t => t.id === prefill.ticketId) ?? null : null;

  const [form, setForm] = React.useState<FormState>({
    title: prefill?.title ?? '',
    desc: prefill?.desc ?? '',
    service: prefill?.serviceId ?? '',
    team: '',
    priority: clampPriority(prefill?.priority),
    deadline: '',
    ticket: prefill?.ticketId ?? '',
  });
  const [priorityTouched, setPriorityTouched] = useState(!!prefill?.priority);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const selectedService = React.useMemo(
    () => services.find(s => s.id === form.service),
    [services, form.service],
  );

  const autoTeamId = React.useMemo(() => {
    const id = selectedService?.responsibleTeam;
    return id && teams.some(t => t.id === id) ? id : '';
  }, [teams, selectedService]);
  const effectiveTeam = form.team || autoTeamId;
  const recommendedTeamName = autoTeamId ? teams.find(t => t.id === autoTeamId)?.name : '';

  const draftIdRef = React.useRef<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  const persistDraft = React.useCallback(async () => {
    if (fromTicket) return;
    if (!form.title.trim() || !form.service) return;
    if (!draftIdRef.current) {
      const task = await createTask({
        title: form.title.trim(),
        desc: form.desc.trim(),
        serviceId: form.service,
        teamId: effectiveTeam || '',
        priority: clampPriority(form.priority as Priority),
        deadline: form.deadline,
        appId: prefill?.appId ?? '',
        ticketId: form.ticket || null,
      });
      draftIdRef.current = task.id;
      addTask(task);
    } else {
      const updated = await updateTask(draftIdRef.current, {
        title: form.title.trim(),
        desc: form.desc.trim(),
        priority: clampPriority(form.priority as Priority),
        deadline: form.deadline,
      });
      setTasks(prev => prev.map(t => (t.id === draftIdRef.current
        ? { ...t, title: updated.title, desc: updated.desc, priority: updated.priority, deadline: updated.deadline }
        : t)));
    }
    setDraftSaved(true);
  }, [fromTicket, form, effectiveTeam, prefill, addTask, setTasks]);

  const autosave = useAutosave(persistDraft);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
    autosave.trigger();
  };

  const onServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const service = e.target.value;
    setFieldErrors(prev => ({ ...prev, service: '' }));
    setForm(prev => {
      const next = { ...prev, service };
      if (!priorityTouched && service) {
        const def = services.find(s => s.id === service)?.defaultPriority;
        if (def) next.priority = clampPriority(def as Priority);
      }
      return next;
    });
    autosave.trigger();
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.title.trim() || form.title.trim().length > 200) errors.title = 'Введите название задачи';
    if (!form.service) errors.service = 'Выберите сервис';
    if (!effectiveTeam) errors.team = 'Выберите команду';
    if (form.deadline && form.deadline < new Date().toISOString().slice(0, 10)) errors.deadline = 'Укажите корректную дату';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);
    try {
      await autosave.flush().catch(() => { });
      const taskId = draftIdRef.current ?? (await createTask({
        title: form.title.trim(),
        desc: form.desc.trim(),
        serviceId: form.service,
        teamId: effectiveTeam,
        priority: clampPriority(form.priority as Priority),
        deadline: form.deadline,
        appId: prefill?.appId ?? '',
        ticketId: form.ticket || null,
      })).id;
      const assigned = await assignTask(taskId, effectiveTeam);
      let linkedTicket: Ticket | undefined;
      if (form.ticket) {
        try { linkedTicket = await linkTaskToTicket(form.ticket, assigned.id); } catch { }
      }
      const final = { ...assigned, ticket: form.ticket || assigned.ticket };
      setTasks(prev => prev.some(t => t.id === final.id)
        ? prev.map(t => (t.id === final.id ? final : t))
        : [final, ...prev]);
      onSubmit(final, linkedTicket);
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="drawer-overlay" style={{ alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal--lg">
        <div className="modal__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#EFF6FF', color: '#2563EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SidebarIcon name={fromTicket ? 'inbox' : 'plus'} size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--c-gray-900)', lineHeight: 1.2 }}>
                {fromTicket ? 'Заявка → задача' : 'Создать задачу'}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--c-gray-500)', margin: 0, lineHeight: 1.4 }}>
                {fromTicket ? `По заявке ${sourceTicket?.id ?? prefill?.ticketId}` : 'Новая задача для команды поддержки'}
              </p>
            </div>
          </div>
          <button className="iconbtn" onClick={onClose} title="Закрыть"><SidebarIcon name="x" size={16} /></button>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {fromTicket && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 14px', borderRadius: 8,
              background: '#EFF6FF', border: '1px solid #BFDBFE',
            }}>
              <SidebarIcon name="inbox" size={15} />
              <div style={{ fontSize: 12, color: '#1D4ED8', lineHeight: 1.5 }}>
                Создаётся по заявке{' '}
                <span className="mono" style={{ fontWeight: 600 }}>{sourceTicket?.id ?? prefill?.ticketId}</span>.
                После создания заявка будет привязана к задаче и переведена в работу.
              </div>
            </div>
          )}

          <div className="field" style={{ margin: 0 }}>
            <label className="field__label">Название <span style={{ color: 'var(--c-error)' }}>*</span></label>
            <input
              className="input"
              placeholder="Например: Настроить VPN-доступ для нового сотрудника"
              value={form.title}
              onChange={set('title')}
              autoFocus
            />
            {fieldErrors.title && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{fieldErrors.title}</div>}
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label className="field__label">Описание</label>
            <textarea
              className="textarea"
              placeholder="Подробное описание задачи: что нужно сделать, для кого, в каких условиях..."
              value={form.desc}
              onChange={set('desc')}
              rows={4}
            />
            <span className="field__help" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <SidebarIcon name="fileText" size={11} />
              Поддерживается Markdown
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field" style={{ margin: 0 }}>
              <label className="field__label">Сервис <span style={{ color: 'var(--c-error)' }}>*</span></label>
              <select className="select" value={form.service} onChange={onServiceChange} disabled={servicesQ.isLoading}>
                <option value="">{servicesQ.isLoading ? 'Загрузка…' : 'Выберите сервис...'}</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {fieldErrors.service && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{fieldErrors.service}</div>}
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label className="field__label">Команда (группа поддержки) <span style={{ color: 'var(--c-error)' }}>*</span></label>
              <select className="select" value={effectiveTeam} onChange={set('team')} disabled={teamsQ.isLoading}>
                <option value="">{teamsQ.isLoading ? 'Загрузка…' : 'Выберите команду...'}</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {fieldErrors.team && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{fieldErrors.team}</div>}
              {recommendedTeamName && (
                <span className="field__help">Рекомендуется по сервису: <b>{recommendedTeamName}</b></span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field" style={{ margin: 0 }}>
              <label className="field__label">Приоритет</label>
              <select
                className="select"
                value={form.priority}
                onChange={e => { setPriorityTouched(true); set('priority')(e); }}
              >
                {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label className="field__label">Дедлайн</label>
              <input className="input" type="date" value={form.deadline} onChange={set('deadline')} />
              {fieldErrors.deadline && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{fieldErrors.deadline}</div>}
            </div>
          </div>

          {!fromTicket && (
            <div className="field" style={{ margin: 0 }}>
              <label className="field__label">Связанная заявка</label>
              <select className="select" value={form.ticket} onChange={set('ticket')}>
                <option value="">Не привязывать</option>
                {openTickets.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <span className="field__help">Необязательно. Привяжите к существующей заявке от пользователя.</span>
            </div>
          )}
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost btn--sm" onClick={onClose} disabled={submitting}>
            {fromTicket ? 'Отмена' : 'Закрыть'}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {apiError ? (
              <div style={{ color: '#f87171', fontSize: 13, padding: '8px 12px', background: 'rgba(220,38,38,0.1)', borderRadius: 6 }}>{apiError}</div>
            ) : !fromTicket ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--c-gray-500)' }}>
                {autosave.status === 'saving' ? (<><SidebarIcon name="refresh" size={12} /> Сохранение…</>)
                  : autosave.status === 'error' ? (<span style={{ color: '#DC2626' }}>Не удалось сохранить черновик</span>)
                  : draftSaved ? (<><SidebarIcon name="checkCircle" size={12} /> Черновик сохранён</>)
                  : (<><SidebarIcon name="cloud" size={12} /> Черновик сохранится автоматически</>)}
              </div>
            ) : null}
          </div>
          <button className="btn btn--primary btn--sm" onClick={handleSubmit} disabled={submitting}>
            <SidebarIcon name="send" size={13} />
            {submitting ? 'Создание…' : fromTicket ? 'Создать и привязать' : 'Назначить команде'}
          </button>
        </div>
      </div>
    </div>
  );
};
