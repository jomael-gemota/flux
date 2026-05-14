import type { NodeProps, Node } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { CanvasNodeData } from '../../store/workflowStore';
import { safeText } from '../../utils/nodeUtils';

type CodeNode = Node<CanvasNodeData, 'workflowNode'>;

export function CodeNodeWidget({ id, data, selected }: NodeProps<CodeNode>) {
  const cfg = data.config as { code?: unknown };
  const code = safeText(cfg.code);
  const lineCount = code ? code.split('\n').length : 0;
  return (
    <BaseNode
      nodeId={id}
      nodeType="code"
      label={data.label}
      isEntry={data.isEntry}
      isParallelEntry={data.isParallelEntry}
      isSelected={selected}
      isDisabled={data.disabled}
    >
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        {lineCount > 0 ? `${lineCount} line${lineCount !== 1 ? 's' : ''}` : 'No code yet'}
      </p>
    </BaseNode>
  );
}
