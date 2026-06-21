import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  FileTextOutlined, CheckCircleOutlined, MessageOutlined, TagOutlined, BellOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../../store/appStore';
import { markNotificationRead as apiMarkRead, markAllNotificationsRead as apiMarkAllRead } from '../../api';

const KIND_ICON: Record<string, React.ReactElement> = {
  task:    <FileTextOutlined />,
  subtask: <CheckCircleOutlined />,
  comment: <MessageOutlined />,
  ticket:  <TagOutlined />,
  system:  <BellOutlined />,
};
const KIND_ICON_DEFAULT = <BellOutlined />;

const TAB_LABELS: Array<{ key: string; label: string }> = [
  { key: 'all',    label: 'Все' },
  { key: 'unread', label: 'Непрочитанные' },
];

export const NotificationsScreen: React.FC = () => {
  const [tab, setTab] = useState<string>('all');

  const notifications    = useAppStore(s => s.notifications);
  const markNotificationRead = useAppStore(s => s.markNotificationRead);
  const markAllRead      = useAppStore(s => s.markAllRead);
  const setDrawerTaskId  = useAppStore(s => s.setDrawerTaskId);
  const setScreen        = useAppStore(s => s.setScreen);
  const setToast         = useAppStore(s => s.setToast);

  const markReadM = useMutation({
    mutationFn: (id: string) => apiMarkRead(id),
    onError: () => setToast({ kind: 'error', msg: 'Не удалось отметить уведомление прочитанным' }),
  });
  const markAllM = useMutation({
    mutationFn: () => apiMarkAllRead(),
    onError: () => setToast({ kind: 'error', msg: 'Не удалось отметить все прочитанными' }),
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const filtered = tab === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  const handleClick = (n: typeof notifications[number]) => {
    if (!n.read) {
      markNotificationRead(n.id);
      markReadM.mutate(n.id);
    }
    if (n.taskId) {
      setDrawerTaskId(n.taskId);
    }
    if (n.kind === 'ticket') {
      setScreen('tickets');
    }
  };

  const handleMarkAll = () => {
    markAllRead();
    markAllM.mutate();
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const day = d.getDate();
    const mon = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][d.getMonth()];
    return `${day} ${mon} · ${h}:${m}`;
  };

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 className="page-title" style={{ margin: 0 }}>Уведомления</h1>
          {unreadCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 22,
                height: 22,
                padding: '0 6px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: '#2563EB',
                color: '#fff',
              }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button className="btn btn--outline" onClick={handleMarkAll}>
            Отметить все прочитанными
          </button>
        )}
      </div>

      {}
      <div className="tabs" style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)' }}>
        {TAB_LABELS.map(t => (
          <button
            key={t.key}
            className={`tabs__item${tab === t.key ? ' tabs__item--active' : ''}`}
            onClick={() => setTab(t.key)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? '#2563EB' : 'var(--c-gray-600)',
              borderBottom: tab === t.key ? '2px solid #2563EB' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {}
      <div className="card" style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-gray-400)', fontSize: 14 }}>
            Нет уведомлений
          </div>
        ) : (
          <div>
            {filtered.map((n, i) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 16px',
                  background: !n.read ? 'var(--c-blue-50)' : 'transparent',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: !n.read ? '#2563EB' : 'var(--c-gray-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {KIND_ICON[n.kind] ?? KIND_ICON_DEFAULT}
                </div>

                {}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: !n.read ? 600 : 400, color: 'var(--c-gray-900)', lineHeight: 1.4 }}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div style={{ fontSize: 12, color: 'var(--c-gray-600)', marginTop: 2, lineHeight: 1.4 }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--c-gray-500)' }}>{formatTime(n.ts)}</span>
                    {n.taskId && (
                      <span className="mono" style={{ fontSize: 11, color: '#2563EB' }}>{n.taskId}</span>
                    )}
                  </div>
                </div>

                {}
                {!n.read && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: '#2563EB',
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
