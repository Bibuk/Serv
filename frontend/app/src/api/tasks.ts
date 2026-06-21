import type { Task, Comment, TaskStatus, SubtaskStatus, Subtask } from '../types';
import { apiClient } from './client';
import type { CreateTaskDto, UpdateTaskDto, CreateCommentDto, TasksQuery } from './dto';
import { TASKS, TICKETS } from '../data/mock';
import {
  unwrap, mapTask, mapSubtask, mapComment, toBackendTaskStatus, toBackendSubtaskStatus,
  type Paginated,
} from './mappers';

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function buildQuery(params?: TasksQuery): string {
  if (!params) return '';
  const q = new URLSearchParams();
  if (params.teamId)     q.set('team_id', params.teamId);
  if (params.status)     q.set('status', toBackendTaskStatus(params.status));
  if (params.assigneeId) q.set('assignee_id', params.assigneeId);
  if (params.appId)      q.set('app_id', params.appId);
  if (params.page)       q.set('page', String(params.page));
  if (params.pageSize)   q.set('size', String(params.pageSize));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function getTasks(params?: TasksQuery): Promise<Task[]> {
  if (USE_MOCK) { await delay(60); return structuredClone(TASKS); }
  const data = await apiClient.get<Paginated<unknown>>(`/tasks/${buildQuery(params)}`);
  return unwrap(data).map(mapTask as (t: unknown) => Task);
}

export async function getTask(id: string): Promise<Task> {
  if (USE_MOCK) {
    await delay(40);
    const t = TASKS.find(t => t.id === id);
    if (!t) throw new Error(`Task ${id} not found`);
    return structuredClone(t);
  }
  return mapTask(await apiClient.get(`/tasks/${id}`));
}

export async function createTask(dto: CreateTaskDto): Promise<Task> {
  if (USE_MOCK) {
    await delay(200);
    const task: Task = {
      id: `T-${Date.now().toString().slice(-3)}`,
      title: dto.title,
      desc: dto.desc,
      service: dto.serviceId,
      team: dto.teamId,
      priority: dto.priority,
      status: 'draft',
      deadline: dto.deadline,
      created: new Date().toISOString().slice(0, 10),
      createdBy: 'u1',
      ticket: dto.ticketId ?? null,
      app: dto.appId,
      subtasks: [],
      comments: [],
      activity: [],
    };
    return task;
  }
  return mapTask(await apiClient.post('/tasks/', {
    title: dto.title,
    description: dto.desc,
    priority: dto.priority,
    service_id: dto.serviceId,
    ticket_id: dto.ticketId ?? null,
    deadline: dto.deadline || null,
  }));
}

export async function updateTask(id: string, dto: UpdateTaskDto): Promise<Task> {
  if (USE_MOCK) {
    await delay(150);
    const t = TASKS.find(t => t.id === id);
    if (!t) throw new Error(`Task ${id} not found`);
    return { ...structuredClone(t), ...dto };
  }
  return mapTask(await apiClient.patch(`/tasks/${id}`, {
    ...(dto.title !== undefined && { title: dto.title }),
    ...(dto.desc !== undefined && { description: dto.desc }),
    ...(dto.priority !== undefined && { priority: dto.priority }),
    ...(dto.deadline !== undefined && { deadline: dto.deadline }),
  }));
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  if (USE_MOCK) {
    await delay(120);
    const t = TASKS.find(t => t.id === id);
    if (!t) throw new Error(`Task ${id} not found`);
    return { ...structuredClone(t), status };
  }
  return mapTask(await apiClient.patch(`/tasks/${id}/status`, { status: toBackendTaskStatus(status) }));
}

export async function acceptTask(id: string): Promise<Task> {
  if (USE_MOCK) {
    await delay(120);
    const t = TASKS.find(t => t.id === id);
    if (!t) throw new Error(`Task ${id} not found`);
    return { ...structuredClone(t), status: 'inprog' };
  }
  return mapTask(await apiClient.post(`/tasks/${id}/accept`));
}

export async function submitTaskReview(id: string): Promise<Task> {
  if (USE_MOCK) {
    await delay(120);
    const t = TASKS.find(t => t.id === id);
    if (!t) throw new Error(`Task ${id} not found`);
    return { ...structuredClone(t), status: 'review' };
  }
  return mapTask(await apiClient.post(`/tasks/${id}/submit-review`));
}

export async function assignTask(id: string, teamId: string): Promise<Task> {
  if (USE_MOCK) {
    await delay(150);
    const t = TASKS.find(t => t.id === id);
    if (!t) throw new Error(`Task ${id} not found`);
    return { ...structuredClone(t), status: 'assigned', team: teamId };
  }
  return mapTask(await apiClient.post(`/tasks/${id}/assign`, { team_id: teamId }));
}

export async function approveTask(id: string): Promise<Task> {
  if (USE_MOCK) {
    await delay(120);
    const t = TASKS.find(t => t.id === id);
    if (!t) throw new Error(`Task ${id} not found`);
    return { ...structuredClone(t), status: 'done' };
  }
  return mapTask(await apiClient.post(`/tasks/${id}/approve`));
}

export async function rejectTask(id: string, reason: string): Promise<Task> {
  if (USE_MOCK) {
    await delay(120);
    const t = TASKS.find(t => t.id === id);
    if (!t) throw new Error(`Task ${id} not found`);
    return { ...structuredClone(t), status: 'reject' };
  }
  return mapTask(await apiClient.post(`/tasks/${id}/reject`, { reason }));
}

export async function getMySubtasks(workerId?: string): Promise<Subtask[]> {
  if (USE_MOCK) {
    await delay(60);
    const out: Subtask[] = [];
    TASKS.forEach(t => t.subtasks.forEach(s => {
      if (!workerId || s.worker === workerId) out.push({ ...structuredClone(s), taskId: t.id });
    }));
    return out;
  }
  const data = await apiClient.get<Paginated<unknown>>('/subtasks/?size=100');
  return unwrap(data).map(mapSubtask as (s: unknown) => Subtask);
}

export async function getTaskComments(taskId: string): Promise<Comment[]> {
  if (USE_MOCK) {
    await delay(40);
    const task = TASKS.find(t => t.id === taskId);
    if (!task) return [];
    const out = [...(task.comments ?? [])];
    if (task.ticket) {
      const tk = TICKETS.find(t => t.id === task.ticket);
      if (tk) out.push(...(tk.comments ?? []));
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  const data = await apiClient.get<Paginated<unknown>>(`/comments/?entity_type=task&entity_id=${taskId}`);
  return unwrap(data).map(mapComment as (c: unknown) => Comment);
}

export async function addTaskComment(id: string, dto: CreateCommentDto): Promise<Comment> {
  if (USE_MOCK) {
    await delay(150);
    const comment: Comment = {
      id: `c${Date.now()}`,
      author: 'u1',
      date: new Date().toISOString(),
      text: dto.text,
      visibleToClient: dto.visibleToClient,
    };
    return comment;
  }
  const c = await apiClient.post<{ id: string; author_id: string; body: string; is_visible_to_client: boolean; created_at: string }>(
    '/comments/',
    { entity_type: 'task', entity_id: id, body: dto.text, is_visible_to_client: dto.visibleToClient },
  );
  return { id: c.id, author: c.author_id, date: c.created_at, text: c.body, visibleToClient: c.is_visible_to_client };
}


export interface CreateSubtaskDto {
  title: string;
  workerId: string;
  deadline?: string;
}

export interface UpdateSubtaskDto {
  title?: string;
  workerId?: string;
  deadline?: string;
  status?: SubtaskStatus;
}

export async function createSubtask(taskId: string, dto: CreateSubtaskDto): Promise<Subtask> {
  if (USE_MOCK) {
    await delay(150);
    return {
      id: `st-${Date.now()}`,
      title: dto.title,
      worker: dto.workerId,
      status: 'todo',
      deadline: dto.deadline ?? new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
    };
  }
  return mapSubtask(await apiClient.post('/subtasks/', {
    task_id: taskId,
    title: dto.title,
    assignee_id: dto.workerId || null,
    deadline: dto.deadline || null,
  }));
}

export async function updateSubtask(taskId: string, subtaskId: string, dto: UpdateSubtaskDto): Promise<Subtask> {
  if (USE_MOCK) {
    await delay(100);
    const t = TASKS.find(t => t.id === taskId);
    const s = t?.subtasks.find(s => s.id === subtaskId);
    if (!s) throw new Error('Subtask not found');
    return { ...structuredClone(s), ...dto, worker: dto.workerId ?? s.worker };
  }
  return mapSubtask(await apiClient.patch(`/subtasks/${subtaskId}`, {
    ...(dto.title && { title: dto.title }),
    ...(dto.workerId && { assignee_id: dto.workerId }),
    ...(dto.deadline && { deadline: dto.deadline }),
    ...(dto.status && { status: toBackendSubtaskStatus(dto.status) }),
  }));
}

export async function deleteSubtask(_taskId: string, subtaskId: string): Promise<void> {
  if (USE_MOCK) { await delay(100); return; }
  await apiClient.delete(`/subtasks/${subtaskId}`);
}


interface RawFileAttachment {
  id: string;
  subtask_id?: string | null;
  task_id?: string | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

export interface FileAttachment {
  id: string;
  subtaskId?: string;
  taskId?: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

function mapFileAttachment(f: RawFileAttachment): FileAttachment {
  return {
    id: String(f.id),
    subtaskId: f.subtask_id ? String(f.subtask_id) : undefined,
    taskId: f.task_id ? String(f.task_id) : undefined,
    filename: f.filename,
    contentType: f.content_type,
    sizeBytes: f.size_bytes,
    uploadedBy: String(f.uploaded_by),
    createdAt: f.created_at,
  };
}

export async function getSubtaskFiles(subtaskId: string): Promise<FileAttachment[]> {
  if (USE_MOCK) { await delay(100); return []; }
  const data: RawFileAttachment[] = await apiClient.get(`/subtasks/${subtaskId}/files`);
  return data.map(mapFileAttachment);
}

export async function uploadSubtaskFile(subtaskId: string, file: File): Promise<FileAttachment> {
  if (USE_MOCK) {
    await delay(400);
    return { id: `f-${Date.now()}`, subtaskId, filename: file.name, contentType: file.type, sizeBytes: file.size, uploadedBy: '', createdAt: new Date().toISOString() };
  }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/subtasks/${subtaskId}/files`, { method: 'POST', body: form, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || 'Не удалось загрузить файл');
  }
  return mapFileAttachment(await res.json() as RawFileAttachment);
}

export async function deleteSubtaskFile(subtaskId: string, fileId: string): Promise<void> {
  if (USE_MOCK) { await delay(200); return; }
  await apiClient.delete(`/subtasks/${subtaskId}/files/${fileId}`);
}

export async function getTaskFiles(taskId: string): Promise<FileAttachment[]> {
  if (USE_MOCK) { await delay(100); return []; }
  const data: RawFileAttachment[] = await apiClient.get(`/tasks/${taskId}/files`);
  return data.map(mapFileAttachment);
}

export async function uploadTaskFile(taskId: string, file: File): Promise<FileAttachment> {
  if (USE_MOCK) {
    await delay(400);
    return { id: `f-${Date.now()}`, taskId, filename: file.name, contentType: file.type, sizeBytes: file.size, uploadedBy: '', createdAt: new Date().toISOString() };
  }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/tasks/${taskId}/files`, { method: 'POST', body: form, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || 'Не удалось загрузить файл');
  }
  return mapFileAttachment(await res.json() as RawFileAttachment);
}

export async function deleteTaskFile(taskId: string, fileId: string): Promise<void> {
  if (USE_MOCK) { await delay(200); return; }
  await apiClient.delete(`/tasks/${taskId}/files/${fileId}`);
}

export async function archiveTask(id: string): Promise<void> {
  if (USE_MOCK) { await delay(150); return; }
  await apiClient.patch<void>(`/tasks/${id}/status`, { status: toBackendTaskStatus('archive') });
}

export async function deleteTask(id: string): Promise<void> {
  if (USE_MOCK) { await delay(150); return; }
  await apiClient.delete(`/tasks/${id}`);
}
