import type { NodeProps, Node } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { CanvasNodeData } from '../../store/workflowStore';

type ConditionNode = Node<CanvasNodeData, 'workflowNode'>;

export function ConditionNodeWidget({ data, selected }: NodeProps<ConditionNode>) {
  return (
    <BaseNode
      nodeType="condition"
      label={data.label}
      isEntry={data.isEntry}
      isSelected={selected}
      handles={{
        outputs: [
          { id: 'true', label: 'true' },
          { id: 'false', label: 'false' },
        ],
      }}
    >
      <p className="text-[10px] text-slate-400">if / else branch</p>
    </BaseNode>
  );
}
