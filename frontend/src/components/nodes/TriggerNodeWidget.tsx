import type { NodeProps, Node } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { CanvasNodeData } from '../../store/workflowStore';
import { safeText } from '../../utils/nodeUtils';

type TriggerNode = Node<CanvasNodeData, 'workflowNode'>;

const TYPE_LABELS: Record<string, string> = {
  manual:    'Manual',
  webhook:   'Webhook',
  cron:      'Schedule',
  app_event: 'App Event',
  email:     'Email',
};

const APP_LABELS: Record<string, string> = {
  basecamp: 'Basecamp',
  slack:    'Slack',
  teams:    'Teams',
  gmail:    'Gmail',
  gdrive:   'Drive',
  gsheets:  'Sheets',
};

const EVENT_LABELS: Record<string, string> = {
  file_changed:         'file changed',
  folder_changed:       'folder changed',
  row_added:            'row added',
  row_updated:          'row updated',
  row_added_or_updated: 'row added/updated',
  any_event:            'any event',
  app_mention:          'app mention',
  file_public:          'file made public',
  file_shared:          'file shared',
  new_message:          'new message',
  new_public_channel:   'new public channel',
  new_user:             'new user',
  reaction_added:       'reaction added',
  new_channel:          'new channel',
  new_channel_message:  'new channel message',
  new_chat:             'new chat',
  new_chat_message:     'new chat message',
  new_team_member:      'new team member',
  new_email:            'new email',
  new_todo:             'new to-do',
  new_comment:          'new comment',
  todo_completed:       'to-do completed',
};

export function TriggerNodeWidget({ id, data, selected }: NodeProps<TriggerNode>) {
  const cfg = data.config as {
    triggerType?: unknown;
    cronExpression?: unknown;
    webhookMethod?: unknown;
    appType?: unknown;
    eventType?: unknown;
  };
  const triggerType    = safeText(cfg.triggerType);
  const cronExpression = safeText(cfg.cronExpression);
  const webhookMethod  = safeText(cfg.webhookMethod);
  const appType        = safeText(cfg.appType);
  const eventType      = safeText(cfg.eventType);

  const typeLabel = triggerType ? (TYPE_LABELS[triggerType] ?? triggerType) : 'Manual';

  let detail = '';
  if (triggerType === 'webhook' && webhookMethod) detail = webhookMethod;
  if (triggerType === 'cron' && cronExpression) detail = cronExpression;
  if (triggerType === 'app_event' && appType) {
    const appLabel = APP_LABELS[appType] ?? appType;
    const evtLabel = eventType ? (EVENT_LABELS[eventType] ?? eventType) : 'event';
    detail = `${appLabel} → ${evtLabel}`;
  }
  if (triggerType === 'email') detail = 'Gmail';

  return (
    <BaseNode
      nodeId={id}
      nodeType="trigger"
      label={data.label}
      isEntry={data.isEntry}
      isParallelEntry={data.isParallelEntry}
      isSelected={selected}
      isDisabled={data.disabled}
    >
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-purple-500 dark:text-purple-400">{typeLabel}</span>
        {detail && <span className="ml-1">({detail})</span>}
      </p>
    </BaseNode>
  );
}
