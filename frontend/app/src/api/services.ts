import { apiClient } from './client';
import { SERVICES, APPS } from '../data/mock';
import { unwrap, type Paginated } from './mappers';
import type { Service, App } from '../types';

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));


interface RawServiceOut {
  id: string;
  name: string;
  description: string;
  color: string;
  category?: string | null;
  responsible_team_id?: string | null;
  default_priority?: string | null;
  sla_reaction_hours?: number | null;
  sla_resolution_hours?: number | null;
  status?: string | null;
}

const mapService = (s: RawServiceOut): Service => ({
  id: s.id,
  name: s.name,
  color: s.color,
  count: 0,
  description: s.description,
  category: (s.category ?? undefined) as Service['category'],
  responsibleTeam: s.responsible_team_id ?? undefined,
  defaultPriority: (s.default_priority ?? undefined) as Service['defaultPriority'],
  sla: {
    reaction: s.sla_reaction_hours ?? 4,
    resolution: s.sla_resolution_hours ?? 24,
  },
  status: (s.status === 'archived' ? 'archived' : 'active'),
});

export async function getServices(): Promise<Service[]> {
  if (USE_MOCK) { await delay(40); return structuredClone(SERVICES); }
  const data = await apiClient.get<Paginated<unknown>>('/services/?size=100');
  return unwrap(data).map(mapService as (s: unknown) => Service);
}

export interface ServiceDto {
  name: string;
  description?: string;
  color?: string;
  category?: string | null;
  responsibleTeamId?: string | null;
  defaultPriority?: string | null;
  slaReaction?: number;
  slaResolution?: number;
  status?: 'active' | 'archived';
}

const serviceBody = (dto: ServiceDto, forCreate: boolean) => ({
  ...(forCreate || dto.name !== undefined ? { name: dto.name } : {}),
  ...(dto.description !== undefined && { description: dto.description }),
  ...(dto.color !== undefined && { color: dto.color }),
  ...(dto.category !== undefined && { category: dto.category }),
  ...(dto.responsibleTeamId !== undefined && { responsible_team_id: dto.responsibleTeamId }),
  ...(dto.defaultPriority !== undefined && { default_priority: dto.defaultPriority }),
  ...(dto.slaReaction !== undefined && { sla_reaction_hours: dto.slaReaction }),
  ...(dto.slaResolution !== undefined && { sla_resolution_hours: dto.slaResolution }),
  ...(dto.status !== undefined && { status: dto.status }),
});

export async function createService(dto: ServiceDto): Promise<Service> {
  if (USE_MOCK) { await delay(150); return { id: `s${Date.now()}`, name: dto.name, color: dto.color ?? '#2563EB', count: 0, description: dto.description }; }
  return mapService(await apiClient.post('/services/', { color: '#2563EB', description: '', ...serviceBody(dto, true) }));
}

export async function updateService(id: string, dto: ServiceDto): Promise<Service> {
  if (USE_MOCK) { await delay(120); return { id, name: dto.name, color: dto.color ?? '#2563EB', count: 0, description: dto.description }; }
  return mapService(await apiClient.patch(`/services/${id}`, serviceBody(dto, false)));
}

export async function deleteService(id: string): Promise<void> {
  if (USE_MOCK) { await delay(120); return; }
  await apiClient.delete(`/services/${id}`);
}


interface RawAppOut {
  id: string;
  name: string;
  description: string;
  color: string;
  status: string;
  service_ids?: string[] | null;
}

const mapApp = (a: RawAppOut): App => ({
  id: a.id, name: a.name, color: a.color, services: a.service_ids ?? [],
  status: a.status === 'archived' ? 'archived' : 'active', description: a.description,
});

export async function getApplications(): Promise<App[]> {
  if (USE_MOCK) { await delay(40); return structuredClone(APPS); }
  const data = await apiClient.get<Paginated<unknown>>('/applications/?size=100');
  return unwrap(data).map(mapApp as (a: unknown) => App);
}

export interface AppDto { name: string; description?: string; color?: string; serviceIds?: string[] }

export async function createApplication(dto: AppDto): Promise<App> {
  if (USE_MOCK) { await delay(150); return { id: `a${Date.now()}`, name: dto.name, color: dto.color ?? '#2563EB', services: dto.serviceIds ?? [], status: 'active', description: dto.description }; }
  return mapApp(await apiClient.post('/applications/', {
    name: dto.name, description: dto.description ?? '', color: dto.color ?? '#2563EB',
    ...(dto.serviceIds !== undefined && { service_ids: dto.serviceIds }),
  }));
}

export async function updateApplication(id: string, dto: AppDto & { status?: 'active' | 'archived' }): Promise<App> {
  if (USE_MOCK) { await delay(120); return { id, name: dto.name ?? '', color: dto.color ?? '#2563EB', services: dto.serviceIds ?? [], status: dto.status ?? 'active', description: dto.description }; }
  return mapApp(await apiClient.patch(`/applications/${id}`, {
    ...(dto.name !== undefined && { name: dto.name }),
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.color !== undefined && { color: dto.color }),
    ...(dto.status !== undefined && { status: dto.status }),
    ...(dto.serviceIds !== undefined && { service_ids: dto.serviceIds }),
  }));
}

export async function setApplicationArchived(id: string, archived: boolean): Promise<App> {
  if (USE_MOCK) { await delay(120); return { id, name: '', color: '#2563EB', services: [], status: archived ? 'archived' : 'active' }; }
  if (archived) return mapApp(await apiClient.patch(`/applications/${id}/archive`));
  return mapApp(await apiClient.patch(`/applications/${id}`, { status: 'active' }));
}
