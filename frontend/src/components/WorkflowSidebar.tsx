import { Plus, Trash2, Loader2, ChevronRight } from 'lucide-react';
import { useWorkflowList, useDeleteWorkflow } from '../hooks/useWorkflows';
import { useWorkflowStore } from '../store/workflowStore';
import { deserialize } from './canvas/canvasUtils';
import type { WorkflowDefinition } from '../types/workflow';
import type { NodeType } from '../types/workflow';

const PALETTE_NODES: Array<{ type: NodeType; label: string; color: string }> = [
  { type: 'http', label: 'HTTP Request', color: 'bg-blue-500' },
  { type: 'llm', label: 'LLM', color: 'bg-emerald-500' },
  { type: 'condition', label: 'Condition', color: 'bg-amber-500' },
  { type: 'switch', label: 'Switch', color: 'bg-orange-500' },
  { type: 'transform', label: 'Transform', color: 'bg-cyan-500' },
  { type: 'output', label: 'Output', color: 'bg-rose-500' },
];

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

  function handleDragStart(
    e: React.DragEvent,
    type: NodeType,
    label: string
  ) {
    e.dataTransfer.setData('application/workflow-node-type', type);
    e.dataTransfer.setData('application/workflow-node-label', label);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-700 flex flex-col shrink-0 overflow-hidden">
      {/* Workflow list */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
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
                    ? 'bg-blue-600/20 text-blue-300'
                    : 'text-slate-300 hover:bg-slate-800'
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

      {/* Node palette */}
      <div className="border-t border-slate-700">
        <div className="px-3 py-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Node Palette
          </span>
          <p className="text-[10px] text-slate-600 mt-0.5">Drag onto canvas</p>
        </div>
        <div className="px-2 pb-3 grid grid-cols-2 gap-1.5">
          {PALETTE_NODES.map((n) => (
            <div
              key={n.type}
              draggable
              onDragStart={(e) => handleDragStart(e, n.type, n.label)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing transition-colors select-none"
            >
              <span className={`w-2 h-2 rounded-sm shrink-0 ${n.color}`} />
              <span className="text-[10px] text-slate-300 truncate">{n.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
