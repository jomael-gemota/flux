import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeTypes,
  type ReactFlowInstance,
  type NodeProps,
  BackgroundVariant,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowStore, type CanvasNode, type CanvasEdge, type CanvasNodeData } from '../../store/workflowStore';
import { HttpNodeWidget } from '../nodes/HttpNodeWidget';
import { LLMNodeWidget } from '../nodes/LLMNodeWidget';
import { ConditionNodeWidget } from '../nodes/ConditionNodeWidget';
import { SwitchNodeWidget } from '../nodes/SwitchNodeWidget';
import { TransformNodeWidget } from '../nodes/TransformNodeWidget';
import { OutputNodeWidget } from '../nodes/OutputNodeWidget';
import type { NodeType } from '../../types/workflow';

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function WorkflowNodeRenderer(props: NodeProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = props as any;
  const nodeType = (props.data as CanvasNodeData).nodeType;
  switch (nodeType) {
    case 'http': return <HttpNodeWidget {...p} />;
    case 'llm': return <LLMNodeWidget {...p} />;
    case 'condition': return <ConditionNodeWidget {...p} />;
    case 'switch': return <SwitchNodeWidget {...p} />;
    case 'transform': return <TransformNodeWidget {...p} />;
    case 'output': return <OutputNodeWidget {...p} />;
    default: return null;
  }
}

const nodeTypes: NodeTypes = { workflowNode: WorkflowNodeRenderer };

const DEFAULT_CONFIGS: Partial<Record<NodeType, Record<string, unknown>>> = {
  http: { method: 'GET', url: '' },
  llm: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 500, userPrompt: '' },
  condition: { condition: { type: 'leaf', left: '', operator: 'eq', right: '' }, trueNext: '', falseNext: '' },
  switch: { cases: [], defaultNext: '' },
  transform: { mappings: {} },
  output: { value: '' },
};

export function WorkflowCanvas() {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    setSelectedNodeId,
    activeWorkflow,
    setDirty,
  } = useWorkflowStore();

  const rfInstance = useRef<ReactFlowInstance<CanvasNode> | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      setNodes(applyNodeChanges(changes, nodes) as CanvasNode[]);
    },
    [nodes, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<CanvasEdge>[]) => {
      setEdges(applyEdgeChanges(changes, edges) as CanvasEdge[]);
    },
    [edges, setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges(addEdge(connection, edges));
    },
    [edges, setEdges]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!rfInstance.current) return;

      const type = e.dataTransfer.getData('application/workflow-node-type') as NodeType;
      const label = e.dataTransfer.getData('application/workflow-node-label');
      if (!type) return;

      const position = rfInstance.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const id = `node-${randomId()}`;
      const isFirst = nodes.length === 0;
      const newNode: CanvasNode = {
        id,
        type: 'workflowNode',
        position,
        data: {
          label,
          nodeType: type,
          config: { ...(DEFAULT_CONFIGS[type] ?? {}) },
          isEntry: isFirst,
        },
      };

      setNodes([...nodes, newNode]);
      setDirty(true);
    },
    [nodes, setNodes, setDirty]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: CanvasNode) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  if (!activeWorkflow) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="text-slate-500 text-sm">Select a workflow or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={(instance) => { rfInstance.current = instance; }}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Delete"
        className="bg-slate-950"
      >
        <Background variant={BackgroundVariant.Dots} color="#334155" gap={20} size={1} />
        <Controls className="!bg-slate-800 !border-slate-600 !text-slate-300" />
        <MiniMap
          className="!bg-slate-900 !border-slate-700"
          nodeColor="#3b82f6"
          maskColor="rgba(15,23,42,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
