import type { NotificationItem } from '../store/appStore';

// Real-time notification stream over WebSocket.
//
// The backend exposes `/ws/{user_id}` and pushes JSON frames of
// `type: "notification"` (see app/services/notification.py). Auth rides on the
// same httpOnly access_token cookie used by the REST client, so no token needs
// to be passed explicitly on a same-origin handshake.
//
// This client owns reconnection (capped exponential backoff) and a keepalive
// ping, and converts backend frames into the store's NotificationItem shape.

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';

// Raw frame as emitted by create_notification() on the backend.
interface NotificationFrame {
  type: 'notification';
  id: string;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface ConnectedFrame { type: 'connected'; user_id: string; message: string }

type ServerFrame = NotificationFrame | ConnectedFrame | { type: string };

function isNotificationFrame(f: ServerFrame): f is NotificationFrame {
  return f.type === 'notification';
}

function toItem(f: NotificationFrame): NotificationItem {
  return {
    id: f.id,
    title: f.title,
    body: f.body,
    read: f.is_read,
    taskId: f.entity_id ?? undefined,
    kind: f.entity_type,
    ts: f.created_at,
  };
}

function socketUrl(userId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/${encodeURIComponent(userId)}`;
}

const PING_INTERVAL_MS = 25_000;     // keep proxies from idling the connection
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export interface NotificationSocketHandlers {
  onNotification: (item: NotificationItem) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export class NotificationSocket {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private closed = false;
  private readonly userId: string;
  private readonly handlers: NotificationSocketHandlers;

  constructor(userId: string, handlers: NotificationSocketHandlers) {
    this.userId = userId;
    this.handlers = handlers;
  }

  start(): void {
    if (USE_MOCK || this.closed) return;
    this.open();
  }

  private open(): void {
    if (this.closed) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(socketUrl(this.userId));
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.startPing();
      this.handlers.onConnect?.();
    };

    ws.onmessage = (ev) => {
      if (ev.data === 'pong') return;
      let frame: ServerFrame;
      try {
        frame = JSON.parse(ev.data as string);
      } catch {
        return; // ignore non-JSON frames
      }
      if (isNotificationFrame(frame)) {
        this.handlers.onNotification(toItem(frame));
      }
    };

    ws.onclose = () => {
      this.stopPing();
      this.handlers.onDisconnect?.();
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose fires right after — reconnect is handled there.
      try { ws.close(); } catch { /* noop */ }
    };
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping');
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.attempts, RECONNECT_MAX_MS);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  close(): void {
    this.closed = true;
    this.stopPing();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) {
      this.ws.onclose = null; // suppress reconnect on intentional close
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }
  }
}
