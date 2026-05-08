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
    - \`"0 8 * * 1"\` — every Monday at 8:00 AM
    - \`"0 0 * * *"\` — every day at midnight
    - \`"0 */6 * * *"\` — every 6 hours

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

## Fluxelle workflow
1. If the user hasn't specified a schedule, use \`ask_user\` to present common
   options:
   - Every 15 minutes
   - Every hour
   - Every day at 9 AM
   - Every weekday at 9 AM
   - Every Monday at 8 AM
   - Custom (ask them to describe)
2. Translate the chosen option (or plain-English description) to a cron
   expression and populate \`cronExpression\`.
3. Always confirm the translated schedule with the user before proposing.
`,
};
