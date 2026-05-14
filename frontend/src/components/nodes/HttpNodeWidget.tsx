import type { NodeProps, Node } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { CanvasNodeData } from '../../store/workflowStore';
import { safeText } from '../../utils/nodeUtils';

type HttpNode = Node<CanvasNodeData, 'workflowNode'>;

export function HttpNodeWidget({ id, data, selected }: NodeProps<HttpNode>) {
  const cfg = data.config as { method?: unknown; url?: unknown };
  const method = safeText(cfg.method);
  const url    = safeText(cfg.url);
  return (
    <BaseNode
      nodeId={id}
      nodeType="http"
      label={data.label}
      isEntry={data.isEntry}
      isParallelEntry={data.isParallelEntry}
      isSelected={selected}
      isDisabled={data.disabled}
    >
      {url && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-blue-600 dark:text-blue-400">{method || 'GET'}</span>{' '}
          {url}
        </p>
      )}
    </BaseNode>
  );
}
