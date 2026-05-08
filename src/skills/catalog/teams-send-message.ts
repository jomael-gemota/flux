import type { Skill } from '../types';

export const skill: Skill = {
    name: 'teams-send-message',
    title: 'Microsoft Teams — Send Message',
    summary: 'Post a message to a Microsoft Teams channel.',
    whenToUse:
        'Use when the user wants to send a message or notification into a Microsoft Teams channel.',
    keywords: ['teams', 'microsoft', 'send', 'message', 'channel', 'notify'],
    category: 'integration',
    nodeType: 'teams',
    requiresCredential: 'teams',
    body: `
# Microsoft Teams — Send Message

Posts a message to a specific Teams channel via Microsoft Graph.

## Required config
- \`credentialId\` (string): Connected Teams credential id.
- \`action\` (string): Must be \`"send_message"\`.
- \`teamId\` (string): Microsoft Teams team id (guid).
- \`channelId\` (string): Channel id within that team.
- \`text\` (string): Message body. Supports template expressions and basic HTML.

## Output fields
- \`messageId\`: Teams message id

## Example
\`\`\`json
{
  "id": "teams-1",
  "type": "teams",
  "name": "Notify Engineering",
  "config": {
    "credentialId": "",
    "action": "send_message",
    "teamId": "",
    "channelId": "",
    "text": "{{ nodes.llm-1.output.content }}"
  },
  "next": []
}
\`\`\`

If the user doesn't know the team / channel ids, leave them empty and tell
them to fill them in via the Config panel after applying.
`,
};
