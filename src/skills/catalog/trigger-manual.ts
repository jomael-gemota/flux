import type { Skill } from '../types';

export const skill: Skill = {
    name: 'trigger-manual',
    title: 'Manual Trigger',
    summary: 'Start a workflow manually with a "Run" button.',
    whenToUse:
        'Use as the entry point when the user wants to run the workflow on demand, ' +
        'one-off, or for testing. Default trigger if no other start is specified.',
    keywords: ['trigger', 'manual', 'start', 'run', 'on demand', 'button'],
    category: 'trigger',
    nodeType: 'trigger',
    body: `
# Manual Trigger

Starts a workflow when the user clicks the **Run** button.

## Config
- \`triggerType\` (string): Must be \`"manual"\`.

## Output fields
- \`triggerType\`: \`"manual"\`
- \`triggeredAt\`: ISO timestamp when the run started

## Example node
\`\`\`json
{
  "id": "trigger-1",
  "type": "trigger",
  "name": "Manual Start",
  "config": { "triggerType": "manual" },
  "next": []
}
\`\`\`
`,
};
