import type { User, Role } from '../types';
import { apiClient } from './client';
import { TEAM } from '../data/mock';
import { unwrap, mapUser, type Paginated } from './mappers';

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface UsersFilter {
  role?: Role | 'client';
  isActive?: boolean;
  teamId?: string;
}

export async function getUsers(filter?: UsersFilter): Promise<User[]> {
  if (USE_MOCK) {
    await delay(50);
    let users = structuredClone(TEAM) as User[];
    if (filter?.role) users = users.filter(u => u.role === filter.role);
    if (filter?.teamId) users = users.filter(u => u.teamId === filter.teamId);
    return users;
  }
  const q = new URLSearchParams();
  if (filter?.role)               q.set('role', filter.role);
  if (filter?.isActive !== undefined) q.set('is_active', String(filter.isActive));
  if (filter?.teamId)             q.set('team_id', filter.teamId);
  q.set('size', '100');
  const data = await apiClient.get<Paginated<unknown>>(`/users/?${q.toString()}`);
  return unwrap(data).map(mapUser as (u: unknown) => User);
}

export interface AdminUserCreateDto {
  name: string;
  email: string;
  password: string;
  role: Role | 'client';
  teamId?: string | null;
}

export interface AdminUserUpdateDto {
  name?: string;
  email?: string;
  role?: Role | 'client';
  teamId?: string | null;
  active?: boolean;
  password?: string;
}

export async function createUser(dto: AdminUserCreateDto): Promise<User> {
  if (USE_MOCK) {
    await delay(200);
    const id = `u${Date.now().toString().slice(-5)}`;
    return mapUser({
      id, email: dto.email, full_name: dto.name, role: dto.role,
      team_id: dto.teamId ?? null, is_active: true,
    } as never);
  }
  return mapUser(await apiClient.post('/users/', {
    full_name: dto.name,
    email: dto.email,
    password: dto.password,
    role: dto.role,
    team_id: dto.teamId ?? null,
  }));
}

export async function updateUser(id: string, dto: AdminUserUpdateDto): Promise<User> {
  if (USE_MOCK) {
    await delay(150);
    const u = TEAM.find(u => u.id === id);
    return mapUser({
      id, email: dto.email ?? u?.email ?? '', full_name: dto.name ?? u?.name ?? '',
      role: dto.role ?? u?.role ?? 'worker', team_id: dto.teamId ?? u?.teamId ?? null,
      is_active: dto.active ?? true,
    } as never);
  }
  return mapUser(await apiClient.patch(`/users/${id}`, {
    ...(dto.name !== undefined && { full_name: dto.name }),
    ...(dto.email !== undefined && { email: dto.email }),
    ...(dto.role !== undefined && { role: dto.role }),
    ...(dto.teamId !== undefined && { team_id: dto.teamId }),
    ...(dto.active !== undefined && { is_active: dto.active }),
    ...(dto.password !== undefined && dto.password !== '' && { password: dto.password }),
  }));
}

export async function deactivateUser(id: string): Promise<void> {
  if (USE_MOCK) { await delay(120); return; }
  await apiClient.delete(`/users/${id}`);
}

export async function setUserActive(id: string, active: boolean): Promise<User> {
  return updateUser(id, { active });
}

export async function getUser(id: string): Promise<User> {
  if (USE_MOCK) {
    await delay(30);
    const u = TEAM.find(u => u.id === id);
    if (!u) throw new Error(`User ${id} not found`);
    return structuredClone(u);
  }
  return mapUser(await apiClient.get(`/users/${id}`));
}

export interface UpdateProfileDto {
  name?: string;
  email?: string;
  phone?: string;
  notifyEmail?: boolean;
}

export async function updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
  if (USE_MOCK) {
    await delay(300);
    const u = TEAM.find(u => u.id === id);
    if (!u) throw new Error('User not found');
    return { ...structuredClone(u), ...dto };
  }
  return mapUser(await apiClient.patch(`/users/${id}`, {
    ...(dto.name !== undefined && { full_name: dto.name }),
    ...(dto.email !== undefined && { email: dto.email }),
    ...(dto.notifyEmail !== undefined && { notify_email: dto.notifyEmail }),
  }));
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
  if (USE_MOCK) {
    await delay(400);
    if (dto.currentPassword === dto.newPassword) {
      throw new Error('Новый пароль совпадает с текущим');
    }
    return;
  }
  await apiClient.post<void>(`/users/${id}/password`, dto);
}
