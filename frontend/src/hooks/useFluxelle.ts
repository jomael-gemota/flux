import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/client';
import type { PersistedMessage, WorkflowSnapshot } from '../types/fluxelle';

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

// ── Conversation history hooks ────────────────────────────────────────────────

const CONV_KEY = ['fluxelle', 'conversations'] as const;

export function useConversations() {
  return useQuery({
    queryKey: CONV_KEY,
    queryFn:  () => api.listConversations().then((r) => r.conversations),
    staleTime: 30_000,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof api.createConversation>[0]) =>
      api.createConversation(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: CONV_KEY }); },
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { messages: PersistedMessage[]; title?: string } }) =>
      api.updateConversation(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: CONV_KEY }); },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: CONV_KEY }); },
  });
}
