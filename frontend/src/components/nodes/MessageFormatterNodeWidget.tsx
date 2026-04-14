import type { NodeProps, Node } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { CanvasNodeData } from '../../store/workflowStore';

type MessageFormatterNode = Node<CanvasNodeData, 'workflowNode'>;

const MEDIUM_LABELS: Record<string, string> = {
  slack: 'Slack',
  teams: 'MS Teams',
  gmail: 'Gmail',
  gdocs: 'Google Docs',
};

export function MessageFormatterNodeWidget({ id, data, selected }: NodeProps<MessageFormatterNode>) {
  const cfg = data.config as { medium?: string; template?: string };
  const mediumLabel = MEDIUM_LABELS[cfg.medium ?? ''] ?? 'No medium';

  return (
    <BaseNode
      nodeId={id}
      nodeType="formatter"
      label={data.label}
      isEntry={data.isEntry}
      isParallelEntry={data.isParallelEntry}
      isSelected={selected}
      isDisabled={data.disabled}
    >
      <p className="text-[10px] text-slate-500 dark:text-slate-400">{mediumLabel}</p>
    </BaseNode>
  );
}
