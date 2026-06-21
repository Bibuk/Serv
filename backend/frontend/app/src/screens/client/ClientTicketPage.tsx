import React, { useState } from 'react';
import {
  InboxOutlined, CheckCircleOutlined, SettingOutlined, CheckCircleFilled,
  CloseCircleOutlined, SearchOutlined, CheckOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { Ticket, TicketStatus, Comment } from '../../types';
import { AppTag } from '../../components';
import { ruDate } from '../../utils/helpers';
import { useAppStore } from '../../store/appStore';
import { addTicketComment, getTicketComments } from '../../api';

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('').slice(0, 2) || '?';
const PALETTE = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0EA5E9'];
const colorOf = (s: string) => { let n = 0; for (let i = 0; i < s.length; i++) n += s.charCodeAt(i); return PALETTE[n % PALETTE.length]; };

// Returns true if the string looks like an internal user ID (no spaces, short, starts with letter+digit pattern)
const isUserId = (s: string) => !!s && !/\s/.test(s) && /^[a-z]\d+$/i.test(s);
const supportName = 'Специалист поддержки';
const supportInitials = 'СП';
const supportColor = '#2563EB';

interface Props {
  ticketId: string | null;
  tickets: Ticket[];
  goto: (screen: string) => void;
  mobile: boolean;
}

const STATUS_BANNER: Record<TicketStatus, { bg: string; color: string; icon: React.ReactElement; label: string; desc: string }> = {
  new: {
    bg: '#EFF6FF',
    color: '#1D4ED8',
    icon: <InboxOutlined />,
    label: 'Новый',
    desc: 'Ваша заявка получена и ожидает рассмотрения специалистом',
  },
  accepted: {
    bg: '#F0FDFA',
    color: '#0D9488',
    icon: <CheckCircleOutlined />,
    label: 'Принята',
    desc: 'Заявка принята в работу. Специалист изучает проблему',
  },
  inprog: {
    bg: '#FFFBEB',
    color: '#D97706',
    icon: <SettingOutlined />,
    label: 'В работе',
    desc: 'Специалисты работают над решением вашей проблемы',
  },
  closed: {
    bg: '#F0FDF4',
    color: '#16A34A',
    icon: <CheckCircleFilled />,
    label: 'Закрыта',
    desc: 'Проблема решена. Если вопрос остался, создайте новую заявку',
  },
  rejected: {
    bg: '#FFF1F2',
    color: '#DC2626',
    icon: <CloseCircleOutlined />,
    label: 'Отклонена',
    desc: 'К сожалению, данная заявка была отклонена. Подробности в комментариях',
  },
};

const TIMELINE_STEPS: Array<{ status: TicketStatus; label: string }> = [
  { status: 'new', label: 'Создана' },
  { status: 'accepted', label: 'Принята' },
  { status: 'inprog', label: 'В работе' },
  { status: 'closed', label: 'Закрыта' },
];

const STATUS_ORDER: TicketStatus[] = ['new', 'accepted', 'inprog', 'closed'];

const formatDatetime = (iso: string) => {
  const d = new Date(iso);
  const day = d.getDate();
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const mon = months[d.getMonth()];
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${mon} ${d.getFullYear()} · ${h}:${m}`;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч. назад`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} д. назад`;
  return formatDatetime(iso);
}

export const ClientTicketPage: React.FC<Props> = ({ ticketId, tickets, goto, mobile }) => {
  const { setToast, currentUser } = useAppStore();
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Comment[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const ticket = tickets.find(t => t.id === ticketId);

  const commentsQ = useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: () => getTicketComments(ticketId!),
    enabled: !!ticketId,
  });

  if (!ticket) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-gray-400)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}><SearchOutlined /></div>
        <p>Заявка не найдена</p>
        <button className="btn btn--outline" onClick={() => goto('tickets')}>← Назад</button>
      </div>
    );
  }

  const banner = STATUS_BANNER[ticket.status] ?? STATUS_BANNER['new'];
  const currentStatusIdx = STATUS_ORDER.indexOf(ticket.status === 'rejected' ? 'closed' : ticket.status);
  // Once a live refetch brings back an optimistic comment, drop the local copy
  // so it isn't shown twice (the WS refresh re-pulls the thread).
  const fetchedComments = commentsQ.data ?? [];
  const fetchedIds = new Set(fetchedComments.map(c => c.id).filter(Boolean));
  const pendingSent = sent.filter(c => !c.id || !fetchedIds.has(c.id));
  const clientComments: Comment[] = [...fetchedComments, ...pendingSent];
  const myName = currentUser?.name ?? '';

  const handleSendComment = async () => {
    if (!commentText.trim() || commentText.length > 1000 || !ticketId) return;
    setSending(true);
    try {
      const comment = await addTicketComment(ticketId, { text: commentText.trim(), visibleToClient: true });
      setSent(prev => [...prev, { ...comment, author: myName || comment.author, visibleToClient: true }]);
      setCommentText('');
    } catch (err) {
      setToast({ kind: 'error', msg: (err as Error).message || 'Не удалось отправить комментарий' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: mobile ? 16 : '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Back button */}
      <button
        onClick={() => goto('tickets')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
          color: '#2563EB',
          fontWeight: 500,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
        }}
      >
        ← Все заявки
      </button>

      {/* Status banner */}
      <div
        style={{
          background: banner.bg,
          border: `1px solid ${banner.color}30`,
          borderRadius: 12,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <span style={{ fontSize: 28, flexShrink: 0, color: banner.color }}>{banner.icon}</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: banner.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Текущий статус
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: banner.color, margin: '2px 0' }}>
            {banner.label}
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-gray-600)' }}>{banner.desc}</div>
        </div>
      </div>

      {/* Satisfaction rating — shown for closed tickets */}
      {ticket.status === 'closed' && (
        <div
          style={{
            background: rating !== null ? '#F0FDF4' : '#FFFBEB',
            border: `1px solid ${rating !== null ? '#BBF7D0' : '#FDE68A'}`,
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {rating === null ? (
            <>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-gray-900)', marginBottom: 2 }}>Как вы оцениваете решение?</div>
                <div style={{ fontSize: 12, color: 'var(--c-gray-500)' }}>Ваша оценка помогает нам стать лучше</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => { setRating(star); setToast({ kind: 'success', msg: 'Спасибо за вашу оценку!' }); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                      fontSize: 28, lineHeight: 1, transition: 'transform 0.1s',
                      transform: (hoverRating ?? 0) >= star ? 'scale(1.15)' : 'scale(1)',
                      color: (hoverRating ?? 0) >= star ? '#F59E0B' : 'var(--c-gray-300)',
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>🙏</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#16A34A' }}>Спасибо за оценку!</div>
                <div style={{ fontSize: 12, color: 'var(--c-gray-500)' }}>
                  Ваша оценка: {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Ticket ID + title */}
          <div>
            <span className="mono" style={{ fontSize: 12, color: 'var(--c-gray-500)', fontWeight: 600 }}>{ticket.id}</span>
            <h1 style={{ margin: '6px 0 0', fontSize: mobile ? 20 : 24, fontWeight: 700, color: 'var(--c-gray-900)', lineHeight: 1.3 }}>
              {ticket.title}
            </h1>
          </div>

          {/* Description card */}
          <div className="card">
            <div className="card__head">
              <span className="card__title">Описание</span>
            </div>
            <div className="card__body" style={{ padding: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--c-gray-700)', lineHeight: 1.6 }}>{ticket.desc}</p>
            </div>
          </div>

          {/* Comments card */}
          <div className="card">
            <div className="card__head">
              <span className="card__title">Обсуждение</span>
              {clientComments.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--c-gray-500)' }}>{clientComments.length}</span>
              )}
            </div>
            <div className="card__body" style={{ padding: 0 }}>
              {clientComments.length === 0 && (
                <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--c-gray-400)', fontSize: 13 }}>
                  Комментариев пока нет. Задайте вопрос или уточните детали заявки.
                </div>
              )}
              {clientComments.map((comment, i) => {
                const isClient = comment.author === myName || comment.author === currentUser?.id;
                const isSupport = !isClient && isUserId(comment.author);
                const displayAuthor = isClient ? (myName || 'Вы') : isSupport ? supportName : comment.author;
                const avatarInitials = isClient ? initialsOf(myName) : isSupport ? supportInitials : initialsOf(comment.author);
                const avatarColor = isClient ? colorOf(myName) : isSupport ? supportColor : colorOf(comment.author);
                return (
                  <div
                    key={comment.id ?? i}
                    style={{
                      padding: '14px 16px',
                      borderBottom: i < clientComments.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      background: isClient ? 'var(--c-gray-50)' : '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 999,
                        background: avatarColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0,
                      }}>
                        {avatarInitials}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{displayAuthor}</span>
                      {(isSupport || (!isClient && !isUserId(comment.author))) && (
                        <span style={{ fontSize: 10, fontWeight: 600, background: '#EFF6FF', color: '#1D4ED8', padding: '1px 6px', borderRadius: 999 }}>
                          Поддержка
                        </span>
                      )}
                      <span title={formatDatetime(comment.date)} style={{ fontSize: 11, color: 'var(--c-gray-400)', marginLeft: 'auto', cursor: 'default' }}>
                        {relativeTime(comment.date)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--c-gray-700)', lineHeight: 1.6 }}>{comment.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comment form */}
          <div className="card">
            <div className="card__head">
              <span className="card__title">Написать сообщение</span>
            </div>
            <div className="card__body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                className="textarea"
                placeholder="Напишите вопрос или уточнение..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                rows={3}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--c-gray-400)' }}>Enter — отправить · Shift+Enter — перенос</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: commentText.length > 900 ? '#DC2626' : 'var(--c-gray-400)' }}>
                    {commentText.length}/1000
                  </span>
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={handleSendComment}
                    disabled={sending || !commentText.trim()}
                  >
                    {sending ? 'Отправка…' : 'Отправить'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Notification info */}
          <div
            style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 13,
              color: '#1D4ED8',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <InfoCircleOutlined style={{ flexShrink: 0, marginTop: 1, fontSize: 16 }} />
            <span>Об изменении статуса заявки вы получите уведомление на электронную почту, указанную при регистрации.</span>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Info card */}
          <div className="card">
            <div className="card__head">
              <span className="card__title">Информация</span>
            </div>
            <div className="card__body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-gray-500)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Приложение</div>
                <AppTag id={ticket.app} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-gray-500)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Приоритет</div>
                <span style={{ fontSize: 13, color: 'var(--c-gray-700)', fontWeight: 500 }}>
                  {ticket.priority === 'critical'
                    ? <><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#DC2626', marginRight: 6, verticalAlign: 'middle' }} />Критичный</>
                    : ticket.priority === 'high'
                    ? <><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#F97316', marginRight: 6, verticalAlign: 'middle' }} />Высокий</>
                    : ticket.priority === 'medium'
                    ? <><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#2563EB', marginRight: 6, verticalAlign: 'middle' }} />Средний</>
                    : <><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#9CA3AF', marginRight: 6, verticalAlign: 'middle' }} />Низкий</>
                  }
                </span>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-gray-500)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Создана</div>
                <span style={{ fontSize: 13, color: 'var(--c-gray-700)' }}>{ruDate(ticket.created)}</span>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-gray-500)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Обновлена</div>
                <span style={{ fontSize: 13, color: 'var(--c-gray-700)' }}>{ruDate(ticket.updated)}</span>
              </div>
              {ticket.taskId && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--c-gray-500)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Задача</div>
                  <span className="mono" style={{ fontSize: 12, color: '#2563EB', fontWeight: 600 }}>{ticket.taskId}</span>
                </div>
              )}
            </div>
          </div>

          {/* History / Timeline card */}
          <div className="card">
            <div className="card__head">
              <span className="card__title">История</span>
            </div>
            <div className="card__body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div className="timeline">
                {TIMELINE_STEPS.map((step, i) => {
                  const isDone = STATUS_ORDER.indexOf(step.status) <= currentStatusIdx;
                  const isActive = STATUS_ORDER.indexOf(step.status) === currentStatusIdx;
                  const isReject = ticket.status === 'rejected' && step.status === 'closed';

                  const dotColor = isReject
                    ? '#DC2626'
                    : isDone
                    ? '#059669'
                    : 'var(--c-gray-200)';

                  return (
                    <div
                      key={step.status}
                      className="tl-item"
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < TIMELINE_STEPS.length - 1 ? 16 : 0, position: 'relative' }}
                    >
                      {/* Connector line */}
                      {i < TIMELINE_STEPS.length - 1 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 9,
                            top: 20,
                            width: 2,
                            height: 'calc(100% - 8px)',
                            background: isDone && STATUS_ORDER.indexOf(TIMELINE_STEPS[i + 1].status) <= currentStatusIdx
                              ? '#059669'
                              : 'var(--c-gray-150)',
                          }}
                        />
                      )}
                      {/* Dot */}
                      <div
                        className="tl-dot"
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          background: dotColor,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: isActive ? `3px solid ${dotColor}40` : 'none',
                          zIndex: 1,
                        }}
                      >
                        {isDone && !isReject && (
                          <CheckOutlined style={{ color: '#fff', fontSize: 10 }} />
                        )}
                      </div>
                      {/* Body */}
                      <div className="tl-body">
                        <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isDone ? 'var(--c-gray-900)' : 'var(--c-gray-400)' }}>
                          {isReject ? 'Отклонена' : step.label}
                        </div>
                        {isDone && (
                          <div className="tl-when" style={{ fontSize: 11, color: 'var(--c-gray-400)', marginTop: 1 }}>
                            {ruDate(ticket.updated)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
