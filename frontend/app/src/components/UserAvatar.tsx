import React from 'react';
import { useAppStore } from '../store/appStore';

interface AvatarProps {
  userId: string;
  name?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  bordered?: boolean;
}

const SIZE = { xs: 20, sm: 24, md: 32, lg: 40 };
const FONT = { xs: 9, sm: 10, md: 12, lg: 14 };

const PALETTE = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0EA5E9', '#EC4899', '#10B981', '#6366F1', '#F59E0B', '#8B5CF6'];
function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('').slice(0, 2) || '?';
}

export const UserAvatar: React.FC<AvatarProps> = ({ userId, name: nameProp, color: colorProp, size = 'sm', bordered = true }) => {
  const storeUser = useAppStore(s => s.users.find(u => u.id === userId));
  const displayName = nameProp ?? storeUser?.name ?? userId;
  const displayColor = colorProp ?? storeUser?.color ?? colorFromString(userId);

  const s = SIZE[size];
  return (
    <span
      title={displayName}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        width: s,
        height: s,
        fontSize: FONT[size],
        fontWeight: 600,
        color: '#fff',
        background: displayColor,
        flexShrink: 0,
        border: bordered ? '2px solid #fff' : 'none',
      }}
    >
      {initials(displayName)}
    </span>
  );
};

export const AvatarGroup: React.FC<{ userIds: string[]; max?: number }> = ({ userIds, max = 4 }) => {
  const visible = userIds.slice(0, max);
  const rest = userIds.length - visible.length;
  return (
    <span style={{ display: 'inline-flex' }}>
      {visible.map((id, i) => (
        <span key={id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
          <UserAvatar userId={id} size="sm" />
        </span>
      ))}
      {rest > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            width: 24,
            height: 24,
            fontSize: 10,
            fontWeight: 600,
            background: '#E5E7EB',
            color: '#374151',
            marginLeft: -8,
            border: '2px solid #fff',
          }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
};
