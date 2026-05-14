import type { NodeProps, Node } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { CanvasNodeData } from '../../store/workflowStore';
import { safeText } from '../../utils/nodeUtils';

type GDocsNode = Node<CanvasNodeData, 'workflowNode'>;

export function GDocsNodeWidget({ id, data, selected }: NodeProps<GDocsNode>) {
  const cfg = data.config as { action?: unknown; title?: unknown; documentId?: unknown };
  const action     = safeText(cfg.action);
  const title      = safeText(cfg.title);
  const documentId = safeText(cfg.documentId);
  return (
    <BaseNode
      nodeId={id}
      nodeType="gdocs"
      label={data.label}
      isEntry={data.isEntry}
      isParallelEntry={data.isParallelEntry}
      isSelected={selected}
      isDisabled={data.disabled}
    >
      {action && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">{action}</span>
          {action === 'create' && title && ` "${title}"`}
          {action !== 'create' && documentId && ` ${documentId}`}
        </p>
      )}
    </BaseNode>
  );
}
