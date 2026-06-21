import type { Priority, TaskStatus, TicketStatus } from '../types';


export interface LoginDto {
  email: string;
  password: string;
  portal: 'internal' | 'client';
}

export interface AuthResponse {
  id: string;
  name: string;
  role: string;
  team: string;
  avatar: string;
  color: string;
  email: string;
}


export interface CreateTaskDto {
  title: string;
  desc: string;
  serviceId: string;
  teamId: string;
  priority: Priority;
  deadline: string;
  appId: string;
  ticketId?: string | null;
}

export interface UpdateTaskDto {
  title?: string;
  desc?: string;
  priority?: Priority;
  deadline?: string;
}

export interface UpdateTaskStatusDto {
  status: TaskStatus;
}


export interface CreateCommentDto {
  text: string;
  visibleToClient: boolean;
}


export interface CreateTicketDto {
  title: string;
  desc: string;
  appId: string;
  priority: Priority;
  attachments?: string[];
}


export interface TasksQuery {
  teamId?: string;
  status?: TaskStatus;
  assigneeId?: string;
  appId?: string;
  page?: number;
  pageSize?: number;
}

export interface TicketsQuery {
  status?: TicketStatus;
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditQuery {
  kind?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
}
