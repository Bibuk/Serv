// Deterministic colour for a team / support group name. The 2nd-line support
// groups are configured at runtime, so colours can't be hard-coded — we derive
// a stable colour from the name instead (same name → same colour every render).
const PALETTE = [
  '#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626',
  '#0EA5E9', '#EC4899', '#10B981', '#6366F1', '#F59E0B', '#8B5CF6',
];

export function teamColor(name: string): string {
  if (!name) return '#6B7280';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
