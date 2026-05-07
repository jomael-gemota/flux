import type { NodeProps, Node } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { CanvasNodeData } from '../../store/workflowStore';

type LoopNode = Node<CanvasNodeData, 'workflowNode'>;

const MODE_LABELS: Record<string, string> = {
  forEach: 'forEach',
  times:   'times',
  while:   'while',
  batch:   'batch',
};

export function LoopNodeWidget({ id, data, selected }: NodeProps<LoopNode>) {
  const cfg = data.config as { mode?: string };
  const mode = cfg.mode && MODE_LABELS[cfg.mode] ? MODE_LABELS[cfg.mode] : 'forEach';
  return (
    <BaseNode
      nodeId={id}
      nodeType="loop"
      label={data.label}
      isEntry={data.isEntry}
      isParallelEntry={data.isParallelEntry}
      isSelected={selected}
      isDisabled={data.disabled}
    >
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        {mode}
      </p>
    </BaseNode>
  );
}
