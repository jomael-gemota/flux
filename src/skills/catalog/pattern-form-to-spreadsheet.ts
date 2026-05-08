import type { Skill } from '../types';

export const skill: Skill = {
    name: 'pattern-form-to-spreadsheet',
    title: 'Pattern — Form Submission → Google Sheet',
    summary: 'Capture inbound webhook data and append it as a row to a Google Sheet.',
    whenToUse:
        'Use when the user wants to log form responses, signups, or any inbound webhook ' +
        'data into a spreadsheet for tracking.',
    keywords: ['form', 'webhook', 'spreadsheet', 'sheets', 'log', 'record', 'capture'],
    category: 'pattern',
    body: `
# Pattern — Form Submission → Google Sheet

A 2-node template:

1. **Trigger (webhook)** — receives form POSTs.
2. **GSheets (append)** — appends one row per submission.

## Example
\`\`\`json
[
  {
    "id": "trigger-1",
    "type": "trigger",
    "name": "Form Webhook",
    "config": { "triggerType": "webhook" },
    "next": ["gsheets-1"]
  },
  {
    "id": "gsheets-1",
    "type": "gsheets",
    "name": "Append Row",
    "config": {
      "credentialId": "",
      "action": "append",
      "spreadsheetId": "",
      "range": "Submissions!A:D",
      "values": [
        "{{ nodes.trigger-1.output.triggeredAt }}",
        "{{ nodes.trigger-1.output.body.name }}",
        "{{ nodes.trigger-1.output.body.email }}",
        "{{ nodes.trigger-1.output.body.message }}"
      ]
    },
    "next": []
  }
]
\`\`\`

If the user hasn't told you the spreadsheet id or the column shape, leave
those fields empty and tell them which fields to fill in after applying.
`,
};
