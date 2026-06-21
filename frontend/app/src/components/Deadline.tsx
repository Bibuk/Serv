import React from 'react';
import { WarningOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { ruDate } from '../utils/helpers';

export const Deadline: React.FC<{ date: string | null; compact?: boolean }> = ({ date, compact }) => {
  if (!date) return <span style={{ color: 'var(--c-gray-400)' }}>—</span>;
  const d = new Date(date + 'T23:59:59');
  const now = new Date('2026-05-14');
  const diffH = (d.getTime() - now.getTime()) / 3600000;
  let color = 'var(--c-gray-700)';
  let icon: React.ReactElement | null = null;
  if (diffH < 0) {
    color = 'var(--c-error)';
    icon = <WarningOutlined />;
  } else if (diffH < 48) {
    color = 'var(--c-warning)';
    icon = <ClockCircleOutlined />;
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color,
        fontSize: compact ? 11 : 12,
        fontWeight: 500,
      }}
    >
      {icon}{ruDate(date)}
    </span>
  );
};
