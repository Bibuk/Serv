import React from 'react';

interface StatProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaDir?: 'up' | 'down' | 'flat';
  alert?: boolean;
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
}

export const Stat: React.FC<StatProps> = ({ label, value, delta, deltaDir = 'up', alert, icon, iconBg, iconColor }) => (
  <div
    style={{
      background: alert
        ? 'linear-gradient(0deg, var(--c-error-light), #fff 70%)'
        : 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}
  >
    {icon && (
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: iconBg ?? 'var(--c-gray-100)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
        color: iconColor ?? (alert ? 'var(--c-error)' : 'var(--c-gray-600)'),
        flexShrink: 0,
      }}>
        {icon}
      </div>
    )}
    <div style={{ fontSize: 12, color: 'var(--c-gray-500)', fontWeight: 500 }}>{label}</div>
    <div
      style={{
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        color: alert ? 'var(--c-error)' : undefined,
      }}
    >
      {value}
    </div>
    {delta && (
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          marginTop: 2,
          color:
            deltaDir === 'up'
              ? 'var(--c-success)'
              : deltaDir === 'down'
              ? 'var(--c-error)'
              : 'var(--c-gray-500)',
        }}
      >
        {deltaDir === 'up' ? '↑ ' : deltaDir === 'down' ? '↓ ' : ''}{delta}
      </div>
    )}
  </div>
);
