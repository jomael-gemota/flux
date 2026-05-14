import type { NodeProps, Node } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { CanvasNodeData } from '../../store/workflowStore';
import { safeText } from '../../utils/nodeUtils';

type LLMNode = Node<CanvasNodeData, 'workflowNode'>;

export function LLMNodeWidget({ id, data, selected }: NodeProps<LLMNode>) {
  const cfg = data.config as { provider?: unknown; model?: unknown };
  const provider = safeText(cfg.provider);
  const model    = safeText(cfg.model);
  const iconType =
    provider === 'anthropic' ? 'anthropic' :
    provider === 'gemini'    ? 'gemini'    :
    provider === 'meta'      ? 'meta'      : 'llm';
  return (
    <BaseNode
      nodeId={id}
      nodeType="llm"
      nodeIconType={iconType}
      label={data.label}
      isEntry={data.isEntry}
      isParallelEntry={data.isParallelEntry}
      isSelected={selected}
      isDisabled={data.disabled}
    >
      {model && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{provider || 'openai'}</span>{' '}
          · {model}
        </p>
      )}
    </BaseNode>
  );
}
