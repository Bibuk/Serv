import { create } from 'zustand';
import type { Role, Task, Ticket, Comment, AuditEntry, ActivityEntry, TaskStatus, User, Service, App, TaskPrefill } from '../types';
import { TASKS, TICKETS, NOTIFICATIONS, AUDIT_LOG, TEAM, SERVICES, APPS } from '../data/mock';

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  taskId?: string;
  kind: string;
  ts: string;
}

interface AppState {
  role: Role;
  currentUser: User | null;
  screen: string;
  drawerTaskId: string | null;
  modal: 'create-task' | 'login' | null;
  taskPrefill: TaskPrefill | null;
  mobile: boolean;
  params: { ticketId?: string; taskId?: string; view?: string; q?: string };
  toast: { kind: 'success' | 'error' | 'info'; msg: string } | null;
  tasks: Task[];
  tickets: Ticket[];
  notifications: NotificationItem[];
  auditLog: AuditEntry[];
  users: User[];
  teams: string[];
  services: Service[];
  apps: App[];
  catalogReady: boolean;
  setCatalogReady: (v: boolean) => void;
  addUser: (user: User) => void;
  addTeam: (team: string) => void;
  updateService: (id: string, data: Partial<Service>) => void;
  deleteService: (id: string) => void;
  updateApp: (id: string, data: Partial<App>) => void;
  deleteApp: (id: string) => void;
  setRole: (role: Role) => void;
  setCurrentUser: (user: User | null) => void;
  setScreen: (screen: string, params?: Partial<AppState['params']>) => void;
  setDrawerTaskId: (id: string | null) => void;
  setModal: (modal: AppState['modal']) => void;
  setTaskPrefill: (prefill: TaskPrefill | null) => void;
  openCreateTask: (prefill?: TaskPrefill | null) => void;
  setMobile: (mobile: boolean) => void;
  setToast: (toast: AppState['toast']) => void;
  setTasks: (tasks: Task[] | ((prev: Task[]) => Task[])) => void;
  setTickets: (tickets: Ticket[] | ((prev: Ticket[]) => Ticket[])) => void;
  addTask: (task: Task) => void;
  addTicket: (ticket: Ticket) => void;
  addTaskComment: (taskId: string, comment: Comment) => void;
  addTaskActivity: (taskId: string, entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  addNotification: (n: NotificationItem) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  addAuditEntry: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
  switchRole: (role: Role) => void;
  logout: () => void;
}

const DEFAULT_SCREEN: Record<Role, string> = {
  manager: 'dashboard',
  teamlead: 'team-dashboard',
  worker: 'my-tasks',
  admin: 'users',
  client: 'tickets',
};

export const useAppStore = create<AppState>((set, get) => ({
  role: 'manager',
  currentUser: null,
  screen: 'login',
  drawerTaskId: null,
  modal: null,
  taskPrefill: null,
  mobile: false,
  params: {},
  toast: null,
  tasks: USE_MOCK ? TASKS : [],
  tickets: USE_MOCK ? TICKETS : [],
  notifications: USE_MOCK ? NOTIFICATIONS.map(n => ({
    id: n.id,
    title: n.title,
    body: '',
    read: !n.unread,
    kind: n.type,
    ts: n.time,
  })) : [],
  auditLog: USE_MOCK ? AUDIT_LOG : [],
  users: USE_MOCK ? TEAM : [],
  teams: [],
  services: USE_MOCK ? SERVICES : [],
  apps: USE_MOCK ? APPS : [],
  catalogReady: USE_MOCK,
  setCatalogReady: (v) => set({ catalogReady: v }),
  setRole: (role) => set({ role }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setScreen: (screen, params = {}) => set(s => ({
    screen,
    params: s.screen === screen ? { ...s.params, ...params } : params,
  })),
  setDrawerTaskId: (id) => set({ drawerTaskId: id }),
  setModal: (modal) => set({ modal }),
  setTaskPrefill: (taskPrefill) => set({ taskPrefill }),
  openCreateTask: (prefill = null) => set({ taskPrefill: prefill, modal: 'create-task' }),
  setMobile: (mobile) => set({ mobile }),
  setToast: (toast) => set({ toast }),
  setTasks: (tasks) => set(s => ({ tasks: typeof tasks === 'function' ? tasks(s.tasks) : tasks })),
  setTickets: (tickets) => set(s => ({ tickets: typeof tickets === 'function' ? tickets(s.tickets) : tickets })),
  addTask: (task) => set(s => ({ tasks: [task, ...s.tasks] })),
  addTicket: (ticket) => set(s => ({ tickets: [ticket, ...s.tickets] })),
  addTaskComment: (taskId, comment) => set(s => ({
    tasks: s.tasks.map(t =>
      t.id === taskId
        ? { ...t, comments: [...t.comments, comment] }
        : t
    ),
  })),
  addTaskActivity: (taskId, entry) => set(s => ({
    tasks: s.tasks.map(t =>
      t.id === taskId
        ? { ...t, activity: [...(t.activity ?? []), { ...entry, id: `act${Date.now()}`, timestamp: new Date().toISOString() }] }
        : t
    ),
  })),
  updateTaskStatus: (taskId, status) => set(s => ({
    tasks: s.tasks.map(t => t.id === taskId ? { ...t, status } : t),
  })),
  addNotification: (n) => set(s => (
    s.notifications.some(x => x.id === n.id)
      ? {}
      : { notifications: [n, ...s.notifications] }
  )),
  markNotificationRead: (id) => set(s => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
  })),
  markAllRead: () => set(s => ({
    notifications: s.notifications.map(n => ({ ...n, read: true })),
  })),
  addAuditEntry: (entry) => set(s => ({
    auditLog: [
      { ...entry, id: `a${Date.now()}`, timestamp: new Date().toISOString() },
      ...s.auditLog,
    ],
  })),
  addUser: (user) => set(s => ({ users: [...s.users, user] })),
  addTeam: (team) => set(s => ({ teams: [...s.teams, team] })),
  updateService: (id, data) => set(s => ({ services: s.services.map(sv => sv.id === id ? { ...sv, ...data } : sv) })),
  deleteService: (id) => set(s => ({ services: s.services.filter(sv => sv.id !== id) })),
  updateApp: (id, data) => set(s => ({ apps: s.apps.map(a => a.id === id ? { ...a, ...data } : a) })),
  deleteApp: (id) => set(s => ({ apps: s.apps.filter(a => a.id !== id) })),
  switchRole: (role) => {
    void get();
    set({ role, screen: DEFAULT_SCREEN[role], drawerTaskId: null, modal: null, taskPrefill: null });
  },
  logout: () => set({ screen: 'login', drawerTaskId: null, modal: null, taskPrefill: null, params: {} }),
}));
