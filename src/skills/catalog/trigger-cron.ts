import type { Skill } from '../types';

export const skill: Skill = {
    name: 'trigger-cron',
    title: 'Scheduled Trigger (Cron)',
    summary: 'Run a workflow on a recurring schedule.',
    whenToUse:
        'Use when the user wants the workflow to run at fixed intervals or times — ' +
        'e.g. "every 15 minutes", "every weekday at 9am", "monthly on the 1st".',
    keywords: ['trigger', 'cron', 'schedule', 'recurring', 'every', 'daily', 'hourly', 'weekly'],
    category: 'trigger',
    nodeType: 'trigger',
    body: `
# Scheduled Trigger (Cron)

Fires the workflow on a cron schedule.

## Config
- \`triggerType\` (string): Must be \`"cron"\`.
- \`cronExpression\` (string): Standard 5-field cron expression. Examples:
    - \`"*/15 * * * *"\` — every 15 minutes
    - \`"0 9 * * 1-5"\` — 9:00 AM on weekdays
    - \`"0 0 1 * *"\` — midnight on the 1st of every month

## Output fields
- \`triggerType\`: \`"cron"\`
- \`scheduledAt\`: ISO timestamp of the scheduled fire time

## Example
\`\`\`json
{
  "id": "trigger-1",
  "type": "trigger",
  "name": "Every 15 Minutes",
  "config": { "triggerType": "cron", "cronExpression": "*/15 * * * *" },
  "next": []
}
\`\`\`

If the user describes a schedule in plain English, translate it to a cron
expression and put it in \`cronExpression\`. If you're unsure, ask the user
to confirm before adding the node.
`,
};
