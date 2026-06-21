import { useMutation } from '@tanstack/react-query';
import { authLogin, authLogout } from '../api';
import type { LoginCredentials } from '../api';
import { useAppStore } from '../store/appStore';

export function useLogin() {
  const setCurrentUser = useAppStore(s => s.setCurrentUser);
  const switchRole = useAppStore(s => s.switchRole);

  return useMutation({
    mutationFn: (creds: LoginCredentials) => authLogin(creds),
    onSuccess: ({ user, role }) => {
      setCurrentUser(user);
      switchRole(role);
    },
  });
}

export function useLogout() {
  const logout = useAppStore(s => s.logout);
  const setCurrentUser = useAppStore(s => s.setCurrentUser);

  return useMutation({
    mutationFn: authLogout,
    onSuccess: () => {
      setCurrentUser(null);
      logout();
    },
  });
}
