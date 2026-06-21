import { apiClient } from './client';
import { TEAM } from '../data/mock';
import { unwrap, mapTeam, type Paginated, type TeamDetail } from './mappers';

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export type { TeamDetail } from './mappers';

function mockTeams(): TeamDetail[] {
  const byName = new Map<string, typeof TEAM>();
  for (const u of TEAM) {
    const key = u.team || 'Без команды';
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(u);
  }
  return [...byName.entries()].map(([name, members], i) => {
    const lead = members.find(m => m.role === 'teamlead') ?? members[0];
    return {
      id: `team-${i}`,
      name,
      teamleadId: lead?.id ?? null,
      teamleadName: lead?.name ?? '',
      members: structuredClone(members),
      created: new Date(2025, 8, 1).toISOString(),
    };
  });
}

export async function getTeams(): Promise<TeamDetail[]> {
  if (USE_MOCK) { await delay(50); return mockTeams(); }
  const data = await apiClient.get<Paginated<unknown>>('/teams/?size=100');
  return unwrap(data).map(mapTeam as (t: unknown) => TeamDetail);
}

export interface CreateTeamDto {
  name: string;
  teamleadId?: string | null;
}

export interface UpdateTeamDto {
  name?: string;
  teamleadId?: string | null;
}

export async function createTeam(dto: CreateTeamDto): Promise<TeamDetail> {
  if (USE_MOCK) {
    await delay(180);
    return { id: `team-${Date.now()}`, name: dto.name, teamleadId: dto.teamleadId ?? null, teamleadName: '', members: [], created: new Date().toISOString() };
  }
  return mapTeam(await apiClient.post('/teams/', {
    name: dto.name,
    teamlead_id: dto.teamleadId ?? null,
  }));
}

export async function updateTeam(id: string, dto: UpdateTeamDto): Promise<TeamDetail> {
  if (USE_MOCK) {
    await delay(150);
    return { id, name: dto.name ?? '', teamleadId: dto.teamleadId ?? null, teamleadName: '', members: [], created: new Date().toISOString() };
  }
  return mapTeam(await apiClient.patch(`/teams/${id}`, {
    ...(dto.name !== undefined && { name: dto.name }),
    ...(dto.teamleadId !== undefined && { teamlead_id: dto.teamleadId }),
  }));
}

export async function deleteTeam(id: string): Promise<void> {
  if (USE_MOCK) { await delay(120); return; }
  await apiClient.delete(`/teams/${id}`);
}
