export type Role = 'manager' | 'teamlead' | 'worker' | 'admin' | 'client';
export type TaskStatus = 'draft' | 'assigned' | 'inprog' | 'review' | 'done' | 'reject' | 'archive';
export type SubtaskStatus = 'todo' | 'inprog' | 'blocked' | 'done';
export type TicketStatus = 'new' | 'accepted' | 'inprog' | 'closed' | 'rejected';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type NotifType = 'task' | 'subtask' | 'comment';

export interface User {
  id: string;
  name: string;
  role: Role | 'client';
  team: string;
  avatar: string;
  color: string;
  email?: string;
  active?: boolean;
  teamId?: string | null;
  notifyEmail?: boolean;
}

export type InfraType = 'web' | 'database' | 'cache' | 'queue' | 'api' | 'network' | 'storage' | 'monitoring';
export type InfraStatus = 'operational' | 'degraded' | 'outage' | 'maintenance';

export type ServiceCategory =
  | 'communications' | 'networks' | 'access' | 'office'
  | 'logistics' | 'finance' | 'sales' | 'infrastructure' | 'business_apps';

export interface SLASettings {
  reaction: number;
  resolution: number;
}

export interface Service {
  id: string;
  name: string;
  color: string;
  count: number;
  description?: string;
  category?: ServiceCategory;
  responsibleTeam?: string;
  defaultPriority?: Priority;
  sla?: SLASettings;
  parentId?: string | null;
  status?: 'active' | 'archived';
  infraType?: InfraType;
  infraStatus?: InfraStatus;
}

export interface App {
  id: string;
  name: string;
  color: string;
  services: string[];
  status: 'active' | 'archived';
  description?: string;
}

export interface Subtask {
  id: string;
  title: string;
  worker: string;
  status: SubtaskStatus;
  deadline: string;
  taskId?: string;
  workerName?: string;
}

export interface Comment {
  id?: string;
  author: string;
  date: string;
  text: string;
  visibleToClient: boolean;
}

export interface ActivityEntry {
  id: string;
  action: string;
  user: string;
  timestamp: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  user: string;
  target: string;
  kind: 'create' | 'update' | 'delete' | 'login';
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  desc: string;
  service: string;
  team: string;
  priority: Priority;
  status: TaskStatus;
  deadline: string;
  created: string;
  createdBy: string;
  ticket: string | null;
  app: string;
  subtasks: Subtask[];
  comments: Comment[];
  activity: ActivityEntry[];
  rejectReason?: string;
}

export interface Ticket {
  id: string;
  title: string;
  desc: string;
  app: string;
  priority: Priority;
  status: TicketStatus;
  created: string;
  updated: string;
  client: string;
  taskId: string | null;
  comments: Comment[];
  rejectReason?: string;
}

export interface TaskPrefill {
  title?: string;
  desc?: string;
  priority?: Priority;
  ticketId?: string;
  serviceId?: string;
  appId?: string;
}

export interface Notification {
  id: string;
  type: NotifType;
  title: string;
  time: string;
  unread: boolean;
  link: string;
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  from: string | null;
  to: string | null;
  when: string;
}
