import React from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  showGrid?: boolean;
  showDots?: boolean;
  showLabels?: boolean;
  fill?: boolean;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  color = 'var(--c-blue-500)',
  height = 120,
  showGrid = true,
  showDots = true,
  showLabels = true,
  fill = true,
}) => {
  if (!data || data.length === 0) return null;

  const width = 300;
  const padT = 10;
  const padB = showLabels ? 24 : 8;
  const padL = 8;
  const padR = 8;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const toX = (i: number) => padL + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;

  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.value) }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const fillPath = fill
    ? `${linePath} L ${points[points.length - 1].x} ${padT + chartH} L ${points[0].x} ${padT + chartH} Z`
    : '';

  const gridLines = showGrid ? [0, 0.25, 0.5, 0.75, 1] : [];

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ overflow: 'visible', display: 'block' }}
    >
      <defs>
        <linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {gridLines.map((ratio, i) => {
        const y = padT + chartH * ratio;
        return (
          <line
            key={i}
            x1={padL}
            y1={y}
            x2={padL + chartW}
            y2={y}
            stroke="var(--c-gray-150)"
            strokeWidth="1"
          />
        );
      })}

      {fill && fillPath && (
        <path d={fillPath} fill="url(#line-fill)" />
      )}

      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {showDots &&
        points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#fff"
            stroke={color}
            strokeWidth="2"
          />
        ))}

      {showLabels &&
        data.map((d, i) => (
          <text
            key={i}
            x={toX(i)}
            y={height - 4}
            textAnchor="middle"
            fontSize="9"
            fill="var(--c-gray-400)"
            fontFamily="Inter, sans-serif"
          >
            {d.label}
          </text>
        ))}
    </svg>
  );
};
