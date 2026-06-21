import { useEffect } from 'react';
import { refreshAccessToken } from '../api/client';

const USE_MOCK = import.meta.env.VITE_API_MOCK !== 'false';

const REFRESH_INTERVAL_MS = 13 * 60 * 1000;

export function useTokenRefresh(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated || USE_MOCK) return;
    const id = setInterval(() => { refreshAccessToken(); }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAuthenticated]);
}
