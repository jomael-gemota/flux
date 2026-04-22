import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/client';
import type { NodeTestResult } from '../types/workflow';

export function useNodeTestResults(workflowId: string | null | undefined) {
  return useQuery({
    queryKey: ['node-test-results', workflowId],
    queryFn: () => api.getNodeTestResults(workflowId!),
    enabled: !!workflowId && !workflowId.startsWith('__new__'),
    staleTime: 0,
  });
}

/**
 * Returns per-node outputs from the most recent successful full workflow run.
 * Used alongside `useNodeTestResults` to populate the variable picker even
 * when nodes haven't been individually tested.
 */
export function useLastRunResults(workflowId: string | null | undefined) {
  return useQuery({
    queryKey: ['last-run-results', workflowId],
    queryFn: () => api.getLastRunResults(workflowId!),
    enabled: !!workflowId && !workflowId.startsWith('__new__'),
    staleTime: 0,
  });
}

export function useTestNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      workflowId,
      nodeId,
      context,
    }: {
      workflowId: string;
      nodeId: string;
      context?: Record<string, unknown>;
    }) => api.testNode(workflowId, nodeId, context),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['node-test-results', vars.workflowId] });
      // Refresh data pickers so completion status, etc. stay in sync after a test run
      qc.invalidateQueries({ queryKey: ['basecamp-todos'] });
    },
  });
}

/** Run a single node as a permanent execution stored in the log. */
export function useRunNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, nodeId }: { workflowId: string; nodeId: string }) =>
      api.runNode(workflowId, nodeId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['executions', vars.workflowId] });
      // Step-run output is stored as a full execution so refresh the run-results
      // cache so the variable picker immediately shows the updated output.
      qc.invalidateQueries({ queryKey: ['last-run-results', vars.workflowId] });
    },
  });
}

export type { NodeTestResult };
