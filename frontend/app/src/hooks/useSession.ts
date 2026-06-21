import { useEffect, useState } from 'react';
import { authMe, authLogout } from '../api';
import { useAppStore } from '../store/appStore';

const PORTAL = import.meta.env.VITE_PORTAL as 'client' | 'internal' | undefined;

function roleMatchesPortal(role: string): boolean {
  if (!PORTAL) return true;
  return PORTAL === 'client' ? role === 'client' : role !== 'client';
}

export function useSession() {
  const [isChecking, setIsChecking] = useState(true);
  const setCurrentUser = useAppStore(s => s.setCurrentUser);
  const switchRole = useAppStore(s => s.switchRole);

  useEffect(() => {
    authMe()
      .then(async result => {
        if (!result) return;
        if (roleMatchesPortal(result.role)) {
          setCurrentUser(result.user);
          switchRole(result.role);
        } else {
          await authLogout().catch(() => {});
        }
      })
      .finally(() => setIsChecking(false));
  }, []);

  return { isChecking };
}
