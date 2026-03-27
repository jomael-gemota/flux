import { useEffect } from 'react';
import { Plus, Trash2, Loader2, ChevronRight } from 'lucide-react';
import { useWorkflowList, useDeleteWorkflow } from '../hooks/useWorkflows';
import { useWorkflowStore } from '../store/workflowStore';
import { deserialize } from './canvas/canvasUtils';
import type { WorkflowDefinition } from '../types/workflow';

// ── Main sidebar ──────────────────────────────────────────────────────────────

export function WorkflowSidebar() {
  const { data: workflows, isLoading } = useWorkflowList();
  const deleteWf = useDeleteWorkflow();
  const {
    activeWorkflow,
    setActiveWorkflow,
    setNodes,
    setEdges,
    setDirty,
    setSelectedNodeId,
  } = useWorkflowStore();

  // Auto-load the first workflow on initial page load / refresh
  useEffect(() => {
    if (workflows?.length && !activeWorkflow) {
      loadWorkflow(workflows[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflows]);

  function loadWorkflow(wf: WorkflowDefinition) {
    const { nodes, edges } = deserialize(wf);
    setActiveWorkflow(wf);
    setNodes(nodes);
    setEdges(edges);
    setDirty(false);
    setSelectedNodeId(null);
  }

  function createNewWorkflow() {
    const newWf: WorkflowDefinition = {
      id: '__new__',
      name: 'New Workflow',
      version: 1,
      nodes: [],
      entryNodeId: '',
    };
    setActiveWorkflow(newWf);
    setNodes([]);
    setEdges([]);
    setDirty(true);
    setSelectedNodeId(null);
  }

  return (
    <aside className="w-56 glass-surface border-r border-white/10 flex flex-col shrink-0 overflow-hidden">
      {/* ── Workflow list ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Workflows
        </span>
        <button
          onClick={createNewWorkflow}
          className="text-slate-400 hover:text-white transition-colors"
          title="New workflow"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
          </div>
        ) : (
          <ul className="py-1">
            {(workflows ?? []).map((wf) => (
              <li
                key={wf.id}
                className={`group flex items-center gap-1 px-3 py-1.5 cursor-pointer transition-colors ${
                  activeWorkflow?.id === wf.id
                    ? 'bg-blue-500/20 text-blue-200'
                    : 'text-slate-300 hover:bg-white/8'
                }`}
                onClick={() => loadWorkflow(wf)}
              >
                <ChevronRight className="w-3 h-3 shrink-0 opacity-50" />
                <span className="text-xs truncate flex-1">{wf.name}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${wf.name}"?`)) {
                      deleteWf.mutate(wf.id);
                      if (activeWorkflow?.id === wf.id) {
                        setActiveWorkflow(null);
                        setNodes([]);
                        setEdges([]);
                      }
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
            {!isLoading && !workflows?.length && (
              <li className="px-3 py-3 text-slate-500 text-xs text-center">
                No workflows yet
              </li>
            )}
          </ul>
        )}
      </div>

    </aside>
  );
}
