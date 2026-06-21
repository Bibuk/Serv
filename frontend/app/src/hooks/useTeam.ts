import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTeams } from '../api';
import type { TeamDetail } from '../api';
import { useAppStore } from '../store/appStore';
import type { User } from '../types';

export interface MyTeamResult {
  team: TeamDetail | null;
  members: User[];
  teamName: string;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

// Resolves the current teamlead's team and its members from the backend.
// Matches by teamlead id first, then by team name (covers mock mode where the
// session user's `team` is a name rather than an id).
export function useMyTeam(): MyTeamResult {
  const currentUser = useAppStore(s => s.currentUser);
  const q = useQuery({ queryKey: ['teams'], queryFn: () => getTeams() });

  const team = useMemo<TeamDetail | null>(() => {
    const teams = q.data ?? [];
    if (currentUser) {
      const byLead = teams.find(t => t.teamleadId && t.teamleadId === currentUser.id);
      if (byLead) return byLead;
      const byTeamId = currentUser.teamId && teams.find(t => t.id === currentUser.teamId);
      if (byTeamId) return byTeamId;
      const byName = teams.find(t => t.name === currentUser.team);
      if (byName) return byName;
    }
    return teams[0] ?? null;
  }, [q.data, currentUser]);

  return {
    team,
    members: team?.members ?? [],
    teamName: team?.name ?? currentUser?.team ?? 'Команда',
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
  };
}
