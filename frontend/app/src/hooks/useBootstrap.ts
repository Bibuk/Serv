import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getTasks, getTickets, getNotifications, getServices, getApplications, getUsers, NotificationSocket } from '../api';
import { useAppStore } from '../store/appStore';

// In mock mode this is a no-op — store is already initialised from mock data.
// In real mode (VITE_API_MOCK=false) this fetches the initial dataset from the
// backend once, right after a successful login / session restore.
const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';

// Fallback poll: WebSocket delivers notifications in real time, but a slower
// poll still reconciles anything missed while the socket was down and picks up
// read-state changes made from other sessions.
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
  const [done, setDone] = useState(USE_MOCK); // mock: skip immediately
  const qc = useQueryClient();
  const setTasks = useAppStore(s => s.setTasks);
  const setTickets = useAppStore(s => s.setTickets);
  const userId = useAppStore(s => s.currentUser?.id ?? null);

  useEffect(() => {
    if (!enabled || USE_MOCK) return;

    // Read role at effect execution time so we don't include it as a dep
    // (we only want this to re-run when enabled flips, not on every role change).
    const { role } = useAppStore.getState();
    const isClient = role === 'client';
    const isAdmin = role === 'admin';

    // Clients have no access to tasks — skip to avoid 403 noise.
    const tasksP = isClient
      ? Promise.resolve()
      : getTasks().then(t => setTasks(Array.isArray(t) ? t : [])).catch(console.error);
    const ticketsP = getTickets().then(t => setTickets(Array.isArray(t) ? t : [])).catch(console.error);
    getNotifications().then(applyNotifications).catch(console.error);

    // Populate store caches used by components (ServiceTag, AppTag, UserAvatar).
    getServices().then(svcs => useAppStore.setState({ services: Array.isArray(svcs) ? svcs : [] })).catch(console.error);
    getApplications().then(apps => useAppStore.setState({ apps: Array.isArray(apps) ? apps : [] })).catch(console.error);
    // User list requires admin — skip for all other roles to avoid 403.
    if (isAdmin) {
      getUsers().then(users => useAppStore.setState({ users: Array.isArray(users) ? users : [] })).catch(console.error);
    }

    // Flip `done` from an async callback (not synchronously in the effect body).
    Promise.allSettled([tasksP, ticketsP]).then(() => setDone(true));
  }, [enabled]);  // re-runs if `enabled` flips true (after login)

  // Real-time notification stream over WebSocket.
  useEffect(() => {
    if (!enabled || USE_MOCK || !userId) return;
    const { addNotification, setToast } = useAppStore.getState();

    // A notification means something the user can see has changed on the
    // backend (ticket status, a comment, a task transition). Re-pull the
    // affected data so open views — including the client's ticket page —
    // update live instead of waiting for a reload. Coalesce bursts.
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
        // Open comment threads / task detail refetch on next read.
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

  // Fallback poll so unread badges stay correct even if the socket drops.
  useEffect(() => {
    if (!enabled || USE_MOCK) return;
    const id = setInterval(() => {
      getNotifications().then(applyNotifications).catch(console.error);
    }, NOTIFICATIONS_POLL_MS);
    return () => clearInterval(id);
  }, [enabled]);

  return { bootstrapDone: done };
}
