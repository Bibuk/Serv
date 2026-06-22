import type { Priority } from '../types';

export function clampPriority(p?: Priority): Priority {
  return p ?? 'medium';
}
