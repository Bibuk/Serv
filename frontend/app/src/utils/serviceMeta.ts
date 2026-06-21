import type { Priority } from '../types';

// Backend TicketPriority/TaskPriority enums only support high/medium/low.
// 'critical' exists in the UI for display only and must be clamped before
// it reaches the API, otherwise create/update calls fail with a 422/500.
export function clampPriority(p?: Priority): Priority {
  return p === 'critical' ? 'high' : (p ?? 'medium');
}
