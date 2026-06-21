import { useEffect, useState } from 'react';
import { authMe, authLogout } from '../api';
import { useAppStore } from '../store/appStore';

const PORTAL = import.meta.env.VITE_PORTAL as 'client' | 'internal' | undefined;

function roleMatchesPortal(role: string): boolean {
  if (!PORTAL) return true;
  return PORTAL === 'client' ? role === 'client' : role !== 'client';
}

// Called once on app mount. Checks httpOnly JWT cookie via /api/auth/me.
// If the authenticated user's role doesn't match the portal, the cookie is
// cleared so a cross-portal session cannot bleed through.
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
          // Cookie belongs to a different portal — revoke it silently.
          await authLogout().catch(() => {});
        }
      })
      .finally(() => setIsChecking(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isChecking };
}
