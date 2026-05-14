import type { NodeProps, Node } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { CanvasNodeData } from '../../store/workflowStore';
import { safeText } from '../../utils/nodeUtils';

type GSheetsNode = Node<CanvasNodeData, 'workflowNode'>;

export function GSheetsNodeWidget({ id, data, selected }: NodeProps<GSheetsNode>) {
  const cfg = data.config as { action?: unknown; spreadsheetId?: unknown; range?: unknown };
  const action = safeText(cfg.action);
  const range  = safeText(cfg.range);
  return (
    <BaseNode
      nodeId={id}
      nodeType="gsheets"
      label={data.label}
      isEntry={data.isEntry}
      isParallelEntry={data.isParallelEntry}
      isSelected={selected}
      isDisabled={data.disabled}
    >
      {action && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-green-600 dark:text-green-400">{action}</span>
          {range && ` ${range}`}
        </p>
      )}
    </BaseNode>
  );
}
