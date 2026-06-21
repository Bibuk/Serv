import React from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/global.css';
import { useAppStore } from './store/appStore';
import { useSession } from './hooks/useSession';
import { useBootstrap } from './hooks/useBootstrap';
import { useTokenRefresh } from './hooks/useTokenRefresh';
import { setUnauthorizedHandler } from './api/client';
import type { Role } from './types';

// 'client' | 'internal' | undefined (undefined = без ограничений, dev)
const PORTAL = import.meta.env.VITE_PORTAL as 'client' | 'internal' | undefined;

// Shells
import { InternalShell, ClientShell, SidebarIcon } from './shells';

// Internal screens
import { LoginScreen } from './screens/internal/LoginScreen';
import { ManagerDashboard } from './screens/internal/ManagerDashboard';
import { ManagerReviewScreen } from './screens/internal/ManagerReviewScreen';
import { TeamleadDashboard } from './screens/internal/TeamleadDashboard';
import { TasksScreen } from './screens/internal/TasksScreen';
import { TaskDrawer } from './screens/internal/TaskDrawer';
import { TaskCreateModal } from './screens/internal/TaskCreateModal';
import { WorkerScreen } from './screens/internal/WorkerScreen';
import { DecomposeScreen } from './screens/internal/DecomposeScreen';
import { AnalyticsScreen } from './screens/internal/AnalyticsScreen';
import { NotificationsScreen } from './screens/internal/NotificationsScreen';
import { ServicesScreen } from './screens/internal/ServicesScreen';
import { AdminScreen } from './screens/internal/AdminScreen';
import { ManagerTicketsScreen } from './screens/internal/ManagerTicketsScreen';

// Client screens
import { ClientTicketsList } from './screens/client/ClientTicketsList';
import { ClientTicketPage } from './screens/client/ClientTicketPage';
import { ClientCreateTicket } from './screens/client/ClientCreateTicket';
import { ClientProfile } from './screens/client/ClientProfile';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const antTheme = {
  token: {
    colorPrimary: '#2563EB',
    colorSuccess: '#059669',
    colorWarning: '#D97706',
    colorError: '#DC2626',
    colorInfo: '#7C3AED',
    borderRadius: 8,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 14,
  },
};

const SCREENS_BY_ROLE: Record<Role, Array<{ id: string; label: string; crumbs: string[] }>> = {
  manager: [
    { id: 'dashboard',     label: 'Дашборд',              crumbs: ['Дашборд'] },
    { id: 'tasks',         label: 'Все задачи',           crumbs: ['Работа', 'Задачи'] },
    { id: 'review',        label: 'На проверке',          crumbs: ['Работа', 'На проверке'] },
    { id: 'decompose',     label: 'Декомпозиция задачи',  crumbs: ['Работа', 'Задачи', 'Декомпозиция'] },
    { id: 'tickets',       label: 'Заявки клиентов',      crumbs: ['Работа', 'Заявки'] },
    { id: 'analytics',     label: 'Аналитика',            crumbs: ['Аналитика'] },
    { id: 'teams',         label: 'Команды',              crumbs: ['Управление', 'Команды'] },
    { id: 'notifications', label: 'Уведомления',          crumbs: ['Уведомления'] },
    { id: 'services',      label: 'Сервисы и приложения', crumbs: ['Настройки', 'Сервисы'] },
  ],
  teamlead: [
    { id: 'team-dashboard', label: 'Дашборд команды', crumbs: ['Дашборд команды'] },
    { id: 'tasks',          label: 'Задачи команды',  crumbs: ['Команда', 'Задачи'] },
    { id: 'decompose',      label: 'Декомпозиция',    crumbs: ['Команда', 'Декомпозиция'] },
    { id: 'analytics',      label: 'Аналитика',       crumbs: ['Аналитика'] },
    { id: 'notifications',  label: 'Уведомления',     crumbs: ['Уведомления'] },
  ],
  worker: [
    { id: 'my-tasks',      label: 'Мои подзадачи', crumbs: ['Мои подзадачи'] },
    { id: 'notifications', label: 'Уведомления',   crumbs: ['Уведомления'] },
    { id: 'profile',       label: 'Профиль',        crumbs: ['Профиль'] },
  ],
  admin: [
    { id: 'users',     label: 'Пользователи',   crumbs: ['Администрирование', 'Пользователи'] },
    { id: 'teams',     label: 'Команды',         crumbs: ['Администрирование', 'Команды'] },
    { id: 'audit-log', label: 'Журнал действий', crumbs: ['Администрирование', 'Журнал'] },
    { id: 'services',  label: 'Сервисы',         crumbs: ['Настройки', 'Сервисы'] },
  ],
  client: [
    { id: 'tickets',       label: 'Мои заявки',      crumbs: [] },
    { id: 'tickets-new',   label: 'Создать заявку',  crumbs: [] },
    { id: 'ticket',        label: 'Страница заявки', crumbs: [] },
    { id: 'notifications', label: 'Уведомления',     crumbs: [] },
    { id: 'profile',       label: 'Профиль',         crumbs: [] },
  ],
};


const Toaster: React.FC = () => {
  const { toast, setToast } = useAppStore();
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  if (!toast) return null;
  return (
    <div className="toasts">
      <div className={`toast toast--${toast.kind}`}>
        {toast.kind === 'success' && <SidebarIcon name="checkCircle" size={16} />}
        {toast.kind === 'error' && <SidebarIcon name="alert" size={16} />}
        {toast.kind === 'info' && <SidebarIcon name="bell" size={16} />}
        <span>{toast.msg}</span>
      </div>
    </div>
  );
};

const renderScreen = (
  role: Role,
  screen: string,
  params: { ticketId?: string; taskId?: string; view?: string; q?: string },
  mobile: boolean,
  tasks: ReturnType<typeof useAppStore.getState>['tasks'],
  tickets: ReturnType<typeof useAppStore.getState>['tickets'],
  setTasks: ReturnType<typeof useAppStore.getState>['setTasks'],
  setDrawerTaskId: (id: string) => void,
  setScreen: (s: string, p?: Record<string, string>) => void,
  setToast: ReturnType<typeof useAppStore.getState>['setToast'],
): React.ReactNode => {
  const goto = (s: string, p: Record<string, string> = {}) => setScreen(s, p);
  const openDrawer = (id: string) => setDrawerTaskId(id);
  // Generic "create task" entry points start from a blank form (no ticket).
  const openCreate = () => useAppStore.getState().openCreateTask();

  if (screen === 'login') {
    return <LoginScreen portal={PORTAL ?? 'internal'} portalLocked={PORTAL !== undefined} />;
  }

  if (role === 'client') {
    if (screen === 'tickets')       return <ClientTicketsList goto={goto} openCreate={() => goto('tickets-new')} tickets={tickets} mobile={mobile} />;
    if (screen === 'ticket')        return <ClientTicketPage ticketId={params.ticketId ?? null} tickets={tickets} goto={s => goto(s)} mobile={mobile} />;
    if (screen === 'tickets-new')   return <ClientCreateTicket goto={goto} onSubmit={() => { setToast({ kind: 'success', msg: 'Заявка успешно создана. Мы пришлём уведомление при изменении статуса.' }); goto('tickets'); }} mobile={mobile} />;
    if (screen === 'notifications') return <NotificationsScreen />;
    if (screen === 'profile')       return <ClientProfile mobile={mobile} />;
  }

  if (role === 'manager') {
    if (screen === 'dashboard')     return <ManagerDashboard goto={goto} openDrawer={openDrawer} openCreate={openCreate} tasks={tasks} tickets={tickets} />;
    if (screen === 'tasks')         return <TasksScreen tasks={tasks} openDrawer={openDrawer} openCreate={openCreate} initialSearch={params.q} />;
    if (screen === 'review')        return <ManagerReviewScreen tasks={tasks} openDrawer={openDrawer} setTasks={setTasks} />;
    if (screen === 'decompose')     return <DecomposeScreen taskId={params.taskId ?? ''} tasks={tasks} openDrawer={openDrawer} />;
    if (screen === 'tickets')       return <ManagerTicketsScreen tickets={tickets} />;
    if (screen === 'analytics')     return <AnalyticsScreen />;
    if (screen === 'teams')         return <AdminScreen subscreen="teams" />;
    if (screen === 'notifications') return <NotificationsScreen />;
    if (screen === 'services')      return <ServicesScreen />;
  }

  if (role === 'teamlead') {
    const view = params.view || 'kanban';
    const myTeam = useAppStore.getState().currentUser?.team;
    const openDecompose = (taskId: string) => setScreen('decompose', { taskId });
    if (screen === 'team-dashboard') return <TeamleadDashboard openDrawer={openDrawer} openDecompose={openDecompose} view={view} setView={v => setScreen(screen, { view: v })} tasks={tasks} setTasks={setTasks} />;
    if (screen === 'tasks')          return <TasksScreen tasks={tasks.filter(t => !myTeam || t.team === myTeam)} openDrawer={openDrawer} openCreate={openCreate} initialSearch={params.q} />;
    if (screen === 'decompose')      return <DecomposeScreen taskId={params.taskId || ''} tasks={tasks} openDrawer={openDrawer} />;
    if (screen === 'analytics')      return <AnalyticsScreen />;
    if (screen === 'notifications')  return <NotificationsScreen />;
  }

  if (role === 'worker') {
    if (screen === 'my-tasks')      return <WorkerScreen openDrawer={openDrawer} tasks={tasks} setTasks={setTasks} />;
    if (screen === 'notifications') return <NotificationsScreen />;
    if (screen === 'profile')       return <ClientProfile mobile={mobile} />;
  }

  if (role === 'admin') {
    if (screen === 'users')     return <AdminScreen subscreen="users" />;
    if (screen === 'teams')     return <AdminScreen subscreen="teams" />;
    if (screen === 'audit-log') return <AdminScreen subscreen="audit-log" />;
    if (screen === 'services')  return <ServicesScreen />;
  }

  return <div className="empty">Экран не реализован</div>;
};

const SessionLoader: React.FC = () => (
  <div style={{
    height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0B0F1A',
  }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Загрузка…</span>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const { role, screen, mobile, params, drawerTaskId, modal, taskPrefill, tasks, tickets, currentUser, setTasks, setTickets, setDrawerTaskId, setModal, setTaskPrefill, openCreateTask, setScreen, setToast } = useAppStore();
  const { isChecking } = useSession();
  const isAuthenticated = currentUser !== null;

  // Fetch real data from backend once authenticated (no-op in mock mode)
  useBootstrap(isAuthenticated);
  // Proactively refresh the access token every 13 min (token lives 15 min).
  // This prevents 401-triggered logout cycles during active sessions.
  useTokenRefresh(isAuthenticated);

  // Auth guard: force login if not authenticated (e.g. direct URL access, expired session)
  const effectiveScreen = (!isAuthenticated && screen !== 'login') ? 'login' : screen;

  if (isChecking) return <SessionLoader />;

  const isClient = role === 'client';
  const isLogin = effectiveScreen === 'login';
  const currentMeta = (SCREENS_BY_ROLE[role] || []).find(s => s.id === effectiveScreen);
  const crumbs = currentMeta?.crumbs || [];
  const openCreate = () => openCreateTask();

  const content = renderScreen(role, effectiveScreen, params, mobile, tasks, tickets, setTasks, setDrawerTaskId, setScreen, setToast);

  const portalContent = isLogin ? content : isClient ? (
    <ClientShell screen={screen} onNav={s => setScreen(s)} mobile={mobile}>
      {content}
    </ClientShell>
  ) : (
    <InternalShell
      role={role}
      screen={screen}
      onNav={s => setScreen(s)}
      crumbs={crumbs}
      onCreate={role === 'manager' ? openCreate : undefined}
    >
      {content}
    </InternalShell>
  );

  return (
    <div className="app">
      {portalContent}
      {drawerTaskId && (
        <TaskDrawer
          taskId={drawerTaskId}
          onClose={() => setDrawerTaskId(null)}
          tasks={tasks}
          setTasks={setTasks}
        />
      )}
      {modal === 'create-task' && (
        <TaskCreateModal
          prefill={taskPrefill}
          onClose={() => { setModal(null); setTaskPrefill(null); }}
          onSubmit={(task, linkedTicket) => {
            setModal(null);
            setTaskPrefill(null);
            if (linkedTicket) {
              setTickets(prev => prev.map(t => t.id === linkedTicket.id ? { ...t, ...linkedTicket } : t));
            } else if (task.ticket) {
              // Fallback: reflect the link locally even if the link API was a no-op.
              setTickets(prev => prev.map(t => t.id === task.ticket ? { ...t, taskId: task.id, status: 'accepted' } : t));
            }
            setToast({ kind: 'success', msg: task.ticket ? 'Задача создана и привязана к заявке' : 'Задача создана и назначена команде' });
          }}
        />
      )}
      <Toaster />
    </div>
  );
};

// 401 responses fail silently — session stays active regardless of token state
setUnauthorizedHandler(() => {});

export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <ConfigProvider theme={antTheme}>
      <AntApp>
        <AppContent />
      </AntApp>
    </ConfigProvider>
  </QueryClientProvider>
);

export default App;
