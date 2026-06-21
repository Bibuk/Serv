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
    // Bridge: ticket thread + client-visible comments from the linked task.
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

// Manager moves a ticket through its lifecycle (new → processing → accepted → closed).
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

// Link an existing task to a ticket → moves the ticket to 'accepted'.
export async function linkTaskToTicket(ticketId: string, taskId: string): Promise<Ticket> {
  if (USE_MOCK) {
    await delay(120);
    const t = TICKETS.find(t => t.id === ticketId);
    return { ...structuredClone(t ?? ({} as Ticket)), id: ticketId, status: 'accepted', taskId };
  }
  return mapTicket(await apiClient.post(`/tickets/${ticketId}/link-task`, { task_id: taskId }));
}
