import type { NodeProps, Node } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { CanvasNodeData } from '../../store/workflowStore';
import { safeText } from '../../utils/nodeUtils';

type SlackNode = Node<CanvasNodeData, 'workflowNode'>;

const ACTION_LABELS: Record<string, string> = {
  send_message:  'Send Message',
  send_dm:       'Send DM',
  upload_file:   'Upload File',
  read_messages: 'Read Messages',
  read_thread:   'Read Thread',
  list_users:    'List Users',
  list_channels: 'List Channels',
};

export function SlackNodeWidget({ id, data, selected }: NodeProps<SlackNode>) {
  const cfg = data.config as {
    action?: unknown;
    channel?: unknown;
    channels?: unknown;
    userId?: unknown;
    userIds?: unknown;
    readSource?: unknown;
    channelFilter?: unknown;
    threadTs?: unknown;
  };

  // Coerce defensively — AI proposals may supply arrays or objects for any of these.
  const action        = safeText(cfg.action);
  const readSource    = safeText(cfg.readSource);
  const channelFilter = safeText(cfg.channelFilter);
  const channelTarget = safeText(cfg.channels || cfg.channel);
  const userTarget    = safeText(cfg.userIds  || cfg.userId);

  const actionLabel = action ? (ACTION_LABELS[action] ?? action) : null;

  const subtitle = (() => {
    if (!action) return null;
    if (action === 'send_message' && channelTarget)
      return ` → #${channelTarget.split(',')[0].trim()}${channelTarget.includes(',') ? ' +more' : ''}`;
    if (action === 'send_dm' && userTarget)
      return ` → @${userTarget.split(',')[0].trim()}${userTarget.includes(',') ? ' +more' : ''}`;
    if (action === 'read_messages') {
      if (readSource === 'dm' && userTarget) return ` DM @${userTarget}`;
      if (channelTarget) return ` from #${channelTarget}`;
    }
    if (action === 'read_thread') {
      if (channelTarget) return ` in #${channelTarget.split(',')[0].trim()}`;
      return null;
    }
    if (action === 'list_channels' && channelFilter && channelFilter !== 'all')
      return ` (${channelFilter})`;
    return null;
  })();

  return (
    <BaseNode
      nodeId={id}
      nodeType="slack"
      label={data.label}
      isEntry={data.isEntry}
      isParallelEntry={data.isParallelEntry}
      isSelected={selected}
      isDisabled={data.disabled}
    >
      {actionLabel && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-violet-600 dark:text-violet-400">{actionLabel}</span>
          {subtitle && <span>{subtitle}</span>}
        </p>
      )}
    </BaseNode>
  );
}
