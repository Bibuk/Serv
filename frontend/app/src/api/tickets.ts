import type { Ticket, Comment, TicketStatus, Priority } from '../types';
import { apiClient } from './client';
import type { CreateTicketDto, CreateCommentDto, TicketsQuery } from './dto';
import { TICKETS, TASKS } from '../data/mock';
import { unwrap, mapTicket, mapComment, toBackendTicketStatus, type Paginated } from './mappers';

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function buildQuery(params?: TicketsQuery): string {
  if (!params) return '';
  const q = new URLSearchParams();
  if (params.status)   q.set('status', toBackendTicketStatus(params.status));
  if (params.clientId) q.set('client_id', params.clientId);
  if (params.page)     q.set('page', String(params.page));
  if (params.pageSize) q.set('size', String(params.pageSize));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function getTickets(params?: TicketsQuery): Promise<Ticket[]> {
  if (USE_MOCK) { await delay(60); return structuredClone(TICKETS); }
  const data = await apiClient.get<Paginated<unknown>>(`/tickets/${buildQuery(params)}`);
  return unwrap(data).map(mapTicket as (t: unknown) => Ticket);
}

export async function getTicket(id: string): Promise<Ticket> {
  if (USE_MOCK) {
    await delay(40);
    const t = TICKETS.find(t => t.id === id);
    if (!t) throw new Error(`Ticket ${id} not found`);
    return structuredClone(t);
  }
  return mapTicket(await apiClient.get(`/tickets/${id}`));
}

export async function createTicket(dto: CreateTicketDto): Promise<Ticket> {
  if (USE_MOCK) {
    await delay(250);
    const ticket: Ticket = {
      id: `TK-${Date.now().toString().slice(-4)}`,
      title: dto.title,
      desc: dto.desc,
      app: dto.appId,
      priority: dto.priority,
      status: 'new',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      client: 'u12',
      taskId: null,
      comments: [],
    };
    return ticket;
  }
  return mapTicket(await apiClient.post('/tickets/', {
    title: dto.title,
    description: dto.desc,
    priority: dto.priority,
    application_id: dto.appId,
  }));
}

export async function addTicketComment(id: string, dto: CreateCommentDto): Promise<Comment> {
  if (USE_MOCK) {
    await delay(150);
    const comment: Comment = {
      id: `c${Date.now()}`,
      author: 'u12',
      date: new Date().toISOString(),
      text: dto.text,
      visibleToClient: true,
    };
    return comment;
  }
  const c = await apiClient.post<{ id: string; author_id: string; body: string; is_visible_to_client: boolean; created_at: string }>(
    '/comments/',
    { entity_type: 'ticket', entity_id: id, body: dto.text, is_visible_to_client: dto.visibleToClient },
  );
  return { id: c.id, author: c.author_id, date: c.created_at, text: c.body, visibleToClient: c.is_visible_to_client };
}

export async function getTicketComments(ticketId: string): Promise<Comment[]> {
  if (USE_MOCK) {
    await delay(40);
    const tk = TICKETS.find(t => t.id === ticketId);
    if (!tk) return [];
    const out = [...(tk.comments ?? [])];
    if (tk.taskId) {
      const task = TASKS.find(t => t.id === tk.taskId);
      if (task) out.push(...(task.comments ?? []).filter(c => c.visibleToClient));
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  const data = await apiClient.get<Paginated<unknown>>(`/comments/?entity_type=ticket&entity_id=${ticketId}`);
  return unwrap(data).map(mapComment as (c: unknown) => Comment);
}

export async function updateTicketStatus(id: string, status: TicketStatus): Promise<Ticket> {
  if (USE_MOCK) {
    await delay(120);
    const t = TICKETS.find(t => t.id === id);
    return { ...structuredClone(t ?? ({} as Ticket)), id, status, updated: new Date().toISOString() };
  }
  return mapTicket(await apiClient.patch(`/tickets/${id}`, { status: toBackendTicketStatus(status) }));
}

export async function rejectTicket(id: string, reason: string): Promise<Ticket> {
  if (USE_MOCK) {
    await delay(120);
    const t = TICKETS.find(t => t.id === id);
    return { ...structuredClone(t ?? ({} as Ticket)), id, status: 'rejected', updated: new Date().toISOString() };
  }
  return mapTicket(await apiClient.post(`/tickets/${id}/reject`, { reason }));
}

export async function updateTicketPriority(id: string, priority: Priority): Promise<Ticket> {
  if (USE_MOCK) {
    await delay(100);
    const t = TICKETS.find(t => t.id === id);
    return { ...structuredClone(t ?? ({} as Ticket)), id, priority, updated: new Date().toISOString() };
  }
  return mapTicket(await apiClient.patch(`/tickets/${id}`, { priority }));
}

export async function linkTaskToTicket(ticketId: string, taskId: string): Promise<Ticket> {
  if (USE_MOCK) {
    await delay(120);
    const t = TICKETS.find(t => t.id === ticketId);
    return { ...structuredClone(t ?? ({} as Ticket)), id: ticketId, status: 'accepted', taskId };
  }
  return mapTicket(await apiClient.post(`/tickets/${ticketId}/link-task`, { task_id: taskId }));
}

interface RawTicketFile {
  id: string;
  ticket_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

export interface TicketFile {
  id: string;
  ticketId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

function mapTicketFile(f: RawTicketFile): TicketFile {
  return {
    id: String(f.id),
    ticketId: String(f.ticket_id),
    filename: f.filename,
    contentType: f.content_type,
    sizeBytes: f.size_bytes,
    uploadedBy: String(f.uploaded_by),
    createdAt: f.created_at,
  };
}

export async function getTicketFiles(ticketId: string): Promise<TicketFile[]> {
  if (USE_MOCK) { await delay(100); return []; }
  const data: RawTicketFile[] = await apiClient.get(`/tickets/${ticketId}/files`);
  return data.map(mapTicketFile);
}

export async function uploadTicketFile(ticketId: string, file: File): Promise<TicketFile> {
  if (USE_MOCK) {
    await delay(400);
    return { id: `tf-${Date.now()}`, ticketId, filename: file.name, contentType: file.type, sizeBytes: file.size, uploadedBy: '', createdAt: new Date().toISOString() };
  }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/tickets/${ticketId}/files`, { method: 'POST', body: form, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || 'Не удалось загрузить файл');
  }
  return mapTicketFile(await res.json() as RawTicketFile);
}

export async function deleteTicketFile(ticketId: string, fileId: string): Promise<void> {
  if (USE_MOCK) { await delay(200); return; }
  await apiClient.delete(`/tickets/${ticketId}/files/${fileId}`);
}
