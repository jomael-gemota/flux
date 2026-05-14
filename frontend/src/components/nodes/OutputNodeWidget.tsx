import type { NodeProps, Node } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { CanvasNodeData } from '../../store/workflowStore';
import { safeText } from '../../utils/nodeUtils';

type OutputNode = Node<CanvasNodeData, 'workflowNode'>;

export function OutputNodeWidget({ id, data, selected }: NodeProps<OutputNode>) {
  const cfg = data.config as { value?: unknown };
  const valueText = safeText(cfg.value);
  return (
    <BaseNode
      nodeId={id}
      nodeType="output"
      label={data.label}
      isEntry={data.isEntry}
      isParallelEntry={data.isParallelEntry}
      isSelected={selected}
      isDisabled={data.disabled}
      handles={{ outputs: [] }}
    >
      {valueText && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 break-all line-clamp-3">{valueText}</p>
      )}
    </BaseNode>
  );
}
