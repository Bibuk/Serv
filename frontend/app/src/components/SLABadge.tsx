import React from 'react';
import type { SLAInfo } from '../utils/sla';
import { SLA_COLORS, SLA_LABELS, formatSLALeft } from '../utils/sla';

// Compact SLA indicator: a coloured dot plus the remaining/overdue time.
// Renders nothing for tasks without a configured SLA unless `showNone` is set.
export const SLABadge: React.FC<{ info: SLAInfo; showNone?: boolean }> = ({ info, showNone }) => {
  if (info.state === 'none' && !showNone) return null;
  const color = SLA_COLORS[info.state];
  const text =
    info.state === 'none' ? SLA_LABELS.none
    : info.state === 'done' ? SLA_LABELS.done
    : formatSLALeft(info);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--c-gray-700)',
      }}
      title={`SLA: ${SLA_LABELS[info.state]}`}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
      <span style={{ color: info.state === 'breached' ? color : 'var(--c-gray-700)' }}>{text}</span>
    </span>
  );
};
