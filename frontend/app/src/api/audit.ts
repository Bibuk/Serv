import type { AuditEntry } from '../types';
import { apiClient } from './client';
import { AUDIT_LOG } from '../data/mock';
import type { AuditQuery } from './dto';
import { unwrap, mapAuditEntry, type Paginated } from './mappers';

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function getAuditLog(params?: AuditQuery): Promise<AuditEntry[]> {
  if (USE_MOCK) {
    await delay(50);
    let entries = structuredClone(AUDIT_LOG) as AuditEntry[];
    if (params?.kind) entries = entries.filter(e => e.kind === params.kind);
    if (params?.userId) entries = entries.filter(e => e.user === params.userId);
    return entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }
  const q = new URLSearchParams();
  if (params?.userId)   q.set('user_id', params.userId);
  if (params?.page)     q.set('page', String(params.page));
  if (params?.pageSize) q.set('size', String(params.pageSize));
  const qs = q.toString();
  const data = await apiClient.get<Paginated<unknown>>(`/audit-log/${qs ? `?${qs}` : ''}`);
  return unwrap(data).map(mapAuditEntry as (a: unknown) => AuditEntry);
}
