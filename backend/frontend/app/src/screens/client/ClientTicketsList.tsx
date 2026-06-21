import React, { useState } from 'react';
import { FileTextOutlined, SmileOutlined } from '@ant-design/icons';
import type { Ticket, TicketStatus } from '../../types';
import { StatusPill, AppTag } from '../../components';
import { ruDate } from '../../utils/helpers';
import { useAppStore } from '../../store/appStore';

interface Props {
  goto: (screen: string, params?: Record<string, string>) => void;
  openCreate: () => void;
  tickets: Ticket[];
  mobile: boolean;
}

type FilterTab = 'all' | TicketStatus;

const FILTER_TABS: Array<{ key: FilterTab; label: string }> = [
  { key: 'all',      label: 'Все' },
  { key: 'new',      label: 'Новые' },
  { key: 'accepted', label: 'В обработке' },
  { key: 'inprog',   label: 'В работе' },
  { key: 'closed',   label: 'Закрытые' },
  { key: 'rejected', label: 'Отклонённые' },
];

// Deterministic colour from any string (works for both real app names and mock ids).
const PALETTE = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0EA5E9', '#EC4899', '#10B981'];
function colorForApp(s: string): string {
  if (!s) return '#9CA3AF';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
const APP_ICON_DEFAULT = <FileTextOutlined />;

export const ClientTicketsList: React.FC<Props> = ({ goto, openCreate, tickets, mobile }) => {
  const currentUser = useAppStore(s => s.currentUser);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // The backend already scopes ticket lists to the signed-in client; the extra
  // name/id match keeps mock mode (unscoped) showing only this client's tickets.
  const myTickets = tickets.filter(t => t.client === currentUser?.id || t.client === currentUser?.name);

  const filtered = activeTab === 'all'
    ? myTickets
    : myTickets.filter(t => t.status === activeTab);

  const countFor = (key: FilterTab) =>
    key === 'all' ? myTickets.length : myTickets.filter(t => t.status === key).length;

  const activeCount = myTickets.filter(t => t.status === 'inprog' || t.status === 'new' || t.status === 'accepted').length;

  if (mobile) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Mobile header */}
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Мои заявки</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--c-gray-500)' }}>{activeCount} активных</p>
        </div>

        <button
          className="btn btn--primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={openCreate}
        >
          + Создать новую заявку
        </button>

        {/* Pill filter tabs scrollable */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                whiteSpace: 'nowrap',
                padding: '5px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === tab.key ? '#2563EB' : 'var(--c-gray-100)',
                color: activeTab === tab.key ? '#fff' : 'var(--c-gray-600)',
                flexShrink: 0,
              }}
            >
              {tab.label}
              {countFor(tab.key) > 0 && (
                <span style={{ marginLeft: 4, fontSize: 11 }}>({countFor(tab.key)})</span>
              )}
            </button>
          ))}
        </div>

        {/* Mobile ticket cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--c-gray-400)' }}>
              {myTickets.length === 0 ? (
                <>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-gray-700)', marginBottom: 4 }}>Заявок пока нет</div>
                  <div style={{ fontSize: 13, marginBottom: 12 }}>Создайте первую заявку, чтобы обратиться в поддержку</div>
                  <button className="btn btn--primary btn--sm" onClick={openCreate}>Создать заявку</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13 }}>Нет заявок в этой категории</div>
                </>
              )}
            </div>
          )}
          {filtered.map(ticket => {
            const appColor = colorForApp(ticket.app);
            const appIcon = APP_ICON_DEFAULT;
            return (
              <div
                key={ticket.id}
                className="card"
                style={{ padding: 14, cursor: 'pointer' }}
                onClick={() => goto('ticket', { ticketId: ticket.id })}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: appColor + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {appIcon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-gray-900)', marginBottom: 6 }}>
                      {ticket.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--c-gray-500)' }}>{ticket.id}</span>
                      <span style={{ color: 'var(--c-gray-300)' }}>·</span>
                      <span style={{ fontSize: 11, color: 'var(--c-gray-500)' }}>{ruDate(ticket.created)}</span>
                    </div>
                  </div>
                  <StatusPill status={ticket.status} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Hero banner */}
      <div
        className="client-hero"
        style={{
          background: 'linear-gradient(135deg, #1D4ED8 0%, #4F46E5 100%)',
          padding: '32px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff' }}>Здравствуйте, {currentUser?.name?.split(' ')[0] ?? 'Пользователь'} <SmileOutlined /></h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.8)', maxWidth: 480 }}>
            Здесь вы можете отслеживать статус своих обращений и создавать новые заявки в службу поддержки
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            background: '#fff',
            color: '#1D4ED8',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          + Создать заявку
        </button>
      </div>

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)' }}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? '#2563EB' : 'var(--c-gray-600)',
                borderBottom: activeTab === tab.key ? '2px solid #2563EB' : '2px solid transparent',
                marginBottom: -1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {tab.label}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: activeTab === tab.key ? '#2563EB' : 'var(--c-gray-100)',
                  color: activeTab === tab.key ? '#fff' : 'var(--c-gray-600)',
                }}
              >
                {countFor(tab.key)}
              </span>
            </button>
          ))}
        </div>

        {/* Ticket list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '56px 32px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              color: 'var(--c-gray-400)',
            }}>
              {myTickets.length === 0 ? (
                <>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-gray-700)', marginBottom: 6 }}>У вас ещё нет заявок</div>
                  <div style={{ fontSize: 14, color: 'var(--c-gray-500)', maxWidth: 360, margin: '0 auto 20px' }}>
                    Здесь будут отображаться все ваши обращения в службу поддержки
                  </div>
                  <button
                    onClick={openCreate}
                    style={{
                      background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8,
                      padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Создать первую заявку
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-gray-700)', marginBottom: 4 }}>Заявок в этой категории нет</div>
                  <div style={{ fontSize: 13, color: 'var(--c-gray-500)' }}>Попробуйте выбрать другой фильтр</div>
                </>
              )}
            </div>
          )}
          {filtered.map(ticket => {
            const appColor = colorForApp(ticket.app);
            const appIcon = APP_ICON_DEFAULT;
            return (
              <div
                key={ticket.id}
                className="tcard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
                onClick={() => goto('ticket', { ticketId: ticket.id })}
              >
                {/* App icon */}
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: appColor + '20',
                    border: `1px solid ${appColor}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {appIcon}
                </div>

                {/* Main content */}
                <div className="tcard__main" style={{ flex: 1, minWidth: 0 }}>
                  <div className="tcard__title" style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-gray-900)', marginBottom: 5 }}>
                    {ticket.title}
                  </div>
                  <div className="tcard__meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="tcard__id mono" style={{ fontSize: 11, color: 'var(--c-gray-500)', fontWeight: 600 }}>{ticket.id}</span>
                    <span style={{ color: 'var(--c-gray-300)' }}>·</span>
                    <AppTag id={ticket.app} />
                    <span style={{ color: 'var(--c-gray-300)' }}>·</span>
                    <span style={{ fontSize: 12, color: 'var(--c-gray-500)' }}>{ruDate(ticket.created)}</span>
                    {ticket.taskId && (
                      <>
                        <span style={{ color: 'var(--c-gray-300)' }}>·</span>
                        <span
                          className="mono"
                          style={{ fontSize: 11, color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}
                          onClick={e => { e.stopPropagation(); goto('task', { taskId: ticket.taskId! }); }}
                        >
                          {ticket.taskId}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <StatusPill status={ticket.status} />

                {/* Chevron */}
                <span style={{ color: 'var(--c-gray-400)', fontSize: 18, flexShrink: 0 }}>›</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
