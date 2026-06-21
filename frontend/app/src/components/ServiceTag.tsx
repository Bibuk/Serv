import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getServices, getApplications } from '../api';

const PALETTE = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0EA5E9', '#EC4899', '#10B981'];
const colorFor = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

const Tag: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '2px 8px 2px 6px',
      borderRadius: 4,
      background: 'var(--c-gray-100)',
      fontSize: 11,
      fontWeight: 500,
      color: 'var(--c-gray-700)',
      border: '1px solid var(--border-subtle)',
    }}
  >
    <span style={{ width: 3, height: 12, borderRadius: 2, background: color }} />
    {label}
  </span>
);

export const ServiceTag: React.FC<{ id: string }> = ({ id }) => {
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: getServices,
    staleTime: 5 * 60_000,
  });
  if (!id) return null;
  const svc = services.find(s => s.id === id || s.name === id);
  if (svc) return <Tag color={svc.color} label={svc.name} />;
  return <Tag color={colorFor(id)} label={id} />;
};

export const AppTag: React.FC<{ id: string }> = ({ id }) => {
  const { data: apps = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: getApplications,
    staleTime: 5 * 60_000,
  });
  if (!id) return null;
  const app = apps.find(a => a.id === id || a.name === id);
  if (app) return <Tag color={app.color} label={app.name} />;
  return <Tag color={colorFor(id)} label={id} />;
};
