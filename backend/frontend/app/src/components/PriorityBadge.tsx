import React from 'react';
import type { Priority } from '../types';

const DOT_COLOR: Record<Priority, string> = {
  critical: '#DC2626',
  high: '#D97706',
  medium: '#2563EB',
  low: '#9CA3AF',
};

const LABEL: Record<Priority, string> = {
  critical: 'Критичный',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

export const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      fontWeight: 500,
      color: 'var(--c-gray-700)',
    }}
  >
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: DOT_COLOR[priority],
        flexShrink: 0,
      }}
    />
    {LABEL[priority]}
  </span>
);
