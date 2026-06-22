import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getTasks, getTickets, getNotifications, getServices, getApplications, getUsers, NotificationSocket } from '../api';
import { useAppStore } from '../store/appStore';

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';

const NOTIFICATIONS_POLL_MS = 60_000;

function applyNotifications(list: Awaited<ReturnType<typeof getNotifications>>) {
  useAppStore.setState({
    notifications: (Array.isArray(list) ? list : []).map(n => ({
      id: n.id, title: n.title, body: n.body, read: n.read,
      taskId: n.taskId, kind: n.kind, ts: n.ts,
    })),
  });
}

export function useBootstrap(enabled: boolean) {
  const [done, setDone] = useState(USE_MOCK);
  const qc = useQueryClient();
  const setTasks = useAppStore(s => s.setTasks);
  const setTickets = useAppStore(s => s.setTickets);
  const userId = useAppStore(s => s.currentUser?.id ?? null);

  useEffect(() => {
    if (!enabled || USE_MOCK) return;

    const { role } = useAppStore.getState();
    const isClient = role === 'client';
    const isAdmin = role === 'admin';

    const tasksP = isClient
      ? Promise.resolve()
      : getTasks().then(t => setTasks(Array.isArray(t) ? t : [])).catch(console.error);
    const ticketsP = getTickets().then(t => setTickets(Array.isArray(t) ? t : [])).catch(console.error);
    getNotifications().then(applyNotifications).catch(console.error);

    Promise.all([
      getServices().then(svcs => useAppStore.setState({ services: Array.isArray(svcs) ? svcs : [] })).catch(console.error),
      getApplications().then(apps => useAppStore.setState({ apps: Array.isArray(apps) ? apps : [] })).catch(console.error),
    ]).finally(() => useAppStore.getState().setCatalogReady(true));
    if (isAdmin) {
      getUsers().then(users => useAppStore.setState({ users: Array.isArray(users) ? users : [] })).catch(console.error);
    }

    Promise.allSettled([tasksP, ticketsP]).then(() => setDone(true));
  }, [enabled]);

  useEffect(() => {
    if (!enabled || USE_MOCK || !userId) return;
    const { addNotification, setToast } = useAppStore.getState();

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        const s = useAppStore.getState();
        getTickets().then(t => s.setTickets(Array.isArray(t) ? t : [])).catch(() => {});
        if (s.role !== 'client') {
          getTasks().then(t => s.setTasks(Array.isArray(t) ? t : [])).catch(() => {});
        }
        qc.invalidateQueries({ queryKey: ['ticket-comments'] });
        qc.invalidateQueries({ queryKey: ['task-comments'] });
        qc.invalidateQueries({ queryKey: ['task'] });
      }, 300);
    };

    const socket = new NotificationSocket(userId, {
      onNotification: (item) => {
        addNotification(item);
        if (!item.read) setToast({ kind: 'info', msg: item.title });
        scheduleRefresh();
      },
    });
    socket.start();
    return () => { if (refreshTimer) clearTimeout(refreshTimer); socket.close(); };
  }, [enabled, userId, qc]);

  useEffect(() => {
    if (!enabled || USE_MOCK) return;
    const id = setInterval(() => {
      getNotifications().then(applyNotifications).catch(console.error);
    }, NOTIFICATIONS_POLL_MS);
    return () => clearInterval(id);
  }, [enabled]);

  return { bootstrapDone: done };
}
