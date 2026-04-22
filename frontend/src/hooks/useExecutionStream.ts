import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ExecutionSummary, NodeResult, PaginatedResponse } from '../types/workflow';

function getAuthParam(): string {
  const jwt = localStorage.getItem('flux_auth_token');
  if (jwt) return `token=${encodeURIComponent(jwt)}`;
  const key = localStorage.getItem('wap_api_key');
  if (key) return `apiKey=${encodeURIComponent(key)}`;
  return '';
}

/**
 * Connects to the SSE stream for a single execution and pushes live node
 * results directly into the React Query cache — no page refresh needed.
 *
 * When the execution finishes, the execution list queries are also invalidated
 * so the sidebar status badge updates instantly.
 */
export function useExecutionStream(
  executionId: string | null,
  workflowId: string | null,
) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!executionId) return;

    const authParam = getAuthParam();
    if (!authParam) return;

    const es = new EventSource(`/api/executions/${executionId}/events?${authParam}`);

    es.addEventListener('node_result', (e: MessageEvent) => {
      const result = JSON.parse(e.data) as NodeResult;

      // Push the result into the detail cache immediately
      qc.setQueryData(
        ['executions', 'detail', executionId],
        (old: ExecutionSummary | undefined) => {
          if (!old) {
            // Cache not populated yet — create a minimal placeholder so the
            // panel can render as soon as the first node finishes.
            return {
              executionId,
              workflowId: workflowId ?? '',
              status: 'running' as const,
              results: [result],
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              triggeredBy: 'manual' as const,
            } as ExecutionSummary;
          }
          const alreadyIn = old.results.some((r) => r.nodeId === result.nodeId);
          return {
            ...old,
            results: alreadyIn
              ? old.results.map((r) => (r.nodeId === result.nodeId ? result : r))
              : [...old.results, result],
          };
        },
      );
    });

    es.addEventListener('complete', (e: MessageEvent) => {
      const { status } = JSON.parse(e.data) as { status: ExecutionSummary['status'] };

      // Finalize the execution status in the detail cache
      qc.setQueryData(
        ['executions', 'detail', executionId],
        (old: ExecutionSummary | undefined) =>
          old ? { ...old, status, completedAt: new Date().toISOString() } : old,
      );

      // Refresh the execution list so the status badge updates instantly
      qc.invalidateQueries({ queryKey: ['executions', 'log', workflowId] });
      qc.invalidateQueries({ queryKey: ['executions', workflowId] });

      // Also update the status inside any cached list entries
      const updateListStatus = (queryKey: unknown[]) => {
        qc.setQueryData(
          queryKey,
          (old: PaginatedResponse<ExecutionSummary> | undefined) => {
            if (!old) return old;
            return {
              ...old,
              data: old.data.map((exec) =>
                exec.executionId === executionId ? { ...exec, status } : exec,
              ),
            };
          },
        );
      };
      updateListStatus(['executions', 'log', workflowId, 20]);
      updateListStatus(['executions', workflowId]);

      es.close();
    });

    es.onerror = () => {
      // On error the browser will retry automatically; close to prevent loops
      // after a clean disconnect (the complete event already closed gracefully).
      es.close();
    };

    return () => es.close();
  }, [executionId, workflowId, qc]);
}
