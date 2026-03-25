import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowDefinition } from '../types/workflow';

export interface CanvasNodeData extends Record<string, unknown> {
  label: string;
  nodeType: string;
  config: Record<string, unknown>;
  isEntry: boolean;
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export type CanvasNode = Node<CanvasNodeData>;
export type CanvasEdge = Edge;

interface WorkflowStore {
  // Active workflow
  activeWorkflow: WorkflowDefinition | null;
  setActiveWorkflow: (wf: WorkflowDefinition | null) => void;

  // React Flow state
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  setNodes: (nodes: CanvasNode[]) => void;
  setEdges: (edges: CanvasEdge[]) => void;

  // Selection
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Dirty tracking
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;

  // Execution log visibility
  logOpen: boolean;
  setLogOpen: (open: boolean) => void;

  // Last triggered execution
  lastExecutionId: string | null;
  setLastExecutionId: (id: string | null) => void;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  activeWorkflow: null,
  setActiveWorkflow: (wf) => set({ activeWorkflow: wf }),

  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),

  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  isDirty: false,
  setDirty: (dirty) => set({ isDirty: dirty }),

  logOpen: false,
  setLogOpen: (open) => set({ logOpen: open }),

  lastExecutionId: null,
  setLastExecutionId: (id) => set({ lastExecutionId: id }),
}));
