import React from 'react';
import { STATUSES } from '../data/mock';
import type { TaskStatus, TicketStatus } from '../types';

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft: { background: 'var(--c-gray-100)', color: 'var(--c-gray-600)', border: 'none' },
  assigned: { background: 'var(--c-blue-100)', color: '#1D4ED8', border: 'none' },
  inprog: { background: 'var(--c-warning-light)', color: 'var(--c-warning)', border: 'none' },
  review: { background: 'var(--c-info-light)', color: 'var(--c-info)', border: 'none' },
  done: { background: 'var(--c-success-light)', color: 'var(--c-success)', border: 'none' },
  todo: { background: 'var(--c-blue-100)', color: '#1D4ED8', border: 'none' },
  blocked: { background: 'var(--c-info-light)', color: 'var(--c-info)', border: 'none' },
  reject: { background: 'var(--c-error-light)', color: 'var(--c-error)', border: 'none' },
  rejected: { background: 'var(--c-error-light)', color: 'var(--c-error)', border: 'none' },
  archive: { background: 'var(--c-gray-200)', color: 'var(--c-gray-700)', border: 'none' },
  new: { background: 'var(--c-blue-100)', color: '#1D4ED8', border: 'none' },
  accepted: { background: 'var(--c-info-light)', color: 'var(--c-info)', border: 'none' },
  closed: { background: 'var(--c-success-light)', color: 'var(--c-success)', border: 'none' },
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUSES[status as TaskStatus | TicketStatus];
  if (!s) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        ...STATUS_STYLE[status],
      }}
    >
      {s.label}
    </span>
  );
};
