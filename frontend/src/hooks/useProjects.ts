import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/client';
import type { Project } from '../api/client';

const QK = ['projects'] as const;

export function useProjectList() {
  return useQuery({
    queryKey: QK,
    queryFn: api.listProjects,
    // Projects are user-scoped by the backend; no extra client-side filtering needed.
    staleTime: 30_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; workflowIds?: string[]; id?: string }) =>
      api.createProject(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; workflowIds?: string[] }) =>
      api.updateProject(id, body),
    // Optimistic update: patch the cached list immediately so the UI feels instant.
    onMutate: async ({ id, ...body }) => {
      await qc.cancelQueries({ queryKey: QK });
      const previous = qc.getQueryData<Project[]>(QK);
      qc.setQueryData<Project[]>(QK, (old = []) =>
        old.map((p) => (p.id === id ? { ...p, ...body } : p))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(QK, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QK });
      const previous = qc.getQueryData<Project[]>(QK);
      qc.setQueryData<Project[]>(QK, (old = []) => old.filter((p) => p.id !== id));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(QK, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
