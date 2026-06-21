import type { User, Role } from '../types';
import { apiClient } from './client';
import type { LoginDto, AuthResponse } from './dto';
import { TEAM } from '../data/mock';

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Maps email prefix to role for mock login
const MOCK_ROLE_MAP: Record<string, string> = {
  admin:    'u11',
  teamlead: 'u2',
  lead:     'u2',
  worker:   'u4',
  dev:      'u3',
  client:   'u12',
};

function mockUserFromEmail(email: string, portal: 'internal' | 'client'): { user: User; role: Role } {
  if (portal === 'client') {
    const user = TEAM.find(u => u.id === 'u12')!;
    return { user, role: 'client' };
  }
  const prefix = email.split('@')[0].toLowerCase();
  const matched = Object.keys(MOCK_ROLE_MAP).find(k => prefix.startsWith(k));
  const userId = matched ? MOCK_ROLE_MAP[matched] : 'u1'; // default: manager
  const user = TEAM.find(u => u.id === userId) ?? TEAM[0];
  return { user, role: user.role as Role };
}

export interface LoginCredentials {
  email: string;
  password: string;
  portal?: 'internal' | 'client';
}

export interface AuthResult {
  user: User;
  role: Role;
}

export async function authLogin(creds: LoginCredentials): Promise<AuthResult> {
  if (USE_MOCK) {
    await delay(450);
    if (!creds.email.trim() || !creds.password.trim()) {
      throw new Error('Введите email и пароль');
    }
    return mockUserFromEmail(creds.email, creds.portal ?? 'internal');
  }

  const data = await apiClient.post<AuthResponse>('/auth/login', {
    email: creds.email,
    password: creds.password,
    portal: creds.portal ?? 'internal',
  } satisfies LoginDto);

  const user: User = {
    id: data.id,
    name: data.name,
    role: data.role as Role,
    team: data.team,
    avatar: data.avatar,
    color: data.color,
    email: data.email,
  };
  return { user, role: data.role as Role };
}

export async function authLogout(): Promise<void> {
  if (USE_MOCK) { await delay(100); return; }
  await apiClient.post<void>('/auth/logout');
}

// Called on app bootstrap to restore session from httpOnly cookie
export async function authMe(): Promise<AuthResult | null> {
  if (USE_MOCK) return null;
  try {
    const data = await apiClient.get<AuthResponse>('/auth/me');
    const user: User = {
      id: data.id,
      name: data.name,
      role: data.role as Role,
      team: data.team,
      avatar: data.avatar,
      color: data.color,
    };
    return { user, role: data.role as Role };
  } catch {
    return null;
  }
}
