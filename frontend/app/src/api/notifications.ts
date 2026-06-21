import { apiClient } from './client';
import { NOTIFICATIONS } from '../data/mock';
import { unwrap, mapNotification, type Paginated } from './mappers';

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  read: boolean;
  taskId?: string;
  kind: string;
  ts: string;
}

export async function getNotifications(): Promise<NotificationDto[]> {
  if (USE_MOCK) {
    await delay(50);
    return NOTIFICATIONS.map(n => ({
      id: n.id,
      title: n.title,
      body: '',
      read: !n.unread,
      kind: n.type,
      ts: n.time,
    }));
  }
  const data = await apiClient.get<Paginated<unknown>>('/notifications/');
  return unwrap(data).map(mapNotification as (n: unknown) => NotificationDto);
}

export async function markNotificationRead(id: string): Promise<void> {
  if (USE_MOCK) { await delay(30); return; }
  await apiClient.patch<void>(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  if (USE_MOCK) { await delay(30); return; }
  await apiClient.patch<void>('/notifications/read-all');
}
