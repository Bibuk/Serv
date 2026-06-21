export const ruDate = (iso: string | null): string => {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]}`;
};

export const rolePillBg = (r: string): string =>
  ({ manager: 'var(--c-blue-100)', teamlead: 'var(--c-info-light)', worker: 'var(--c-gray-100)', admin: 'var(--c-warning-light)' }[r] || 'var(--c-gray-100)');

export const rolePillFg = (r: string): string =>
  ({ manager: '#1D4ED8', teamlead: 'var(--c-info)', worker: 'var(--c-gray-700)', admin: 'var(--c-warning)' }[r] || 'var(--c-gray-700)');
