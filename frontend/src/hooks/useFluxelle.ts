import { useMutation, useQuery } from '@tanstack/react-query';
import * as api from '../api/client';
import type { WorkflowSnapshot } from '../types/fluxelle';

export function useFluxelleStatus() {
  return useQuery({
    queryKey: ['fluxelle', 'status'],
    queryFn:  () => api.getFluxelleStatus(),
    staleTime: 60_000,
  });
}

export function useFluxelleChat() {
  return useMutation({
    mutationFn: (body: {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      workflow?: WorkflowSnapshot | null;
    }) => api.fluxelleChat(body),
  });
}

export function useSkillsList() {
  return useQuery({
    queryKey: ['skills'],
    queryFn:  () => api.listSkills(),
    select:   (data) => data.skills,
  });
}
