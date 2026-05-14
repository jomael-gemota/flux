import type { NodeProps, Node } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { CanvasNodeData } from '../../store/workflowStore';
import { safeText } from '../../utils/nodeUtils';

type GmailNode = Node<CanvasNodeData, 'workflowNode'>;

export function GmailNodeWidget({ id, data, selected }: NodeProps<GmailNode>) {
  const cfg = data.config as {
    action?: unknown;
    to?: unknown;
    fromFilter?: unknown;
    subjectFilter?: unknown;
    readStatus?: unknown;
  };

  // Coerce defensively — AI proposals may supply arrays or objects for any of these.
  const action        = safeText(cfg.action);
  const fromFilter    = safeText(cfg.fromFilter);
  const subjectFilter = safeText(cfg.subjectFilter);
  const readStatus    = safeText(cfg.readStatus);
  const toString      = Array.isArray(cfg.to) ? cfg.to.map(safeText).join(',') : safeText(cfg.to);

  function firstRecipient(to: string): string | undefined {
    if (!to) return undefined;
    const first = to.split(',')[0];
    return first?.trim() || undefined;
  }

  const recipient = firstRecipient(toString);
  const toCount   = toString ? toString.split(',').filter(Boolean).length : 0;

  return (
    <BaseNode
      nodeId={id}
      nodeType="gmail"
      label={data.label}
      isEntry={data.isEntry}
      isParallelEntry={data.isParallelEntry}
      isSelected={selected}
      isDisabled={data.disabled}
    >
      {action && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          <span className={`font-semibold ${action === 'send_flux' || action === 'reply_flux' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
            {action === 'send'       ? 'Send'
            : action === 'send_flux'  ? '⚡ Flux Send'
            : action === 'reply_flux' ? '⚡ Flux Reply'
            : action === 'list'      ? 'List'
            : 'Read'}
          </span>
          {(action === 'send' || action === 'send_flux') && recipient && (
            <span> → {recipient}{toCount > 1 ? ` +${toCount - 1}` : ''}</span>
          )}
          {action === 'list' && fromFilter && ` from:${fromFilter}`}
          {action === 'list' && subjectFilter && ` subj:${subjectFilter}`}
          {action === 'list' && readStatus && readStatus !== 'all' && (
            <span className="ml-1 italic">{readStatus}</span>
          )}
        </p>
      )}
    </BaseNode>
  );
}
