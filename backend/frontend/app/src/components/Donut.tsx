import React from 'react';

interface Slice {
  v: number;
  color: string;
  label: string;
}

export const Donut: React.FC<{ slices: Slice[]; value: string | number; label: string }> = ({
  slices,
  value,
  label,
}) => {
  const total = slices.reduce((s, x) => s + x.v, 0);
  let acc = 0;
  const r = 60;
  const c = 2 * Math.PI * r;

  return (
    <div style={{ width: 160, height: 160, position: 'relative' }}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="var(--c-gray-100)"
          strokeWidth="20"
        />
        {slices.map((s, i) => {
          const len = (s.v / total) * c;
          const rot = (acc / total) * 360 - 90;
          acc += s.v;
          return (
            <circle
              key={i}
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="20"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset="0"
              transform={`rotate(${rot} 80 80)`}
            />
          );
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
          <div style={{ fontSize: 11, color: 'var(--c-gray-500)' }}>{label}</div>
        </div>
      </div>
    </div>
  );
};
