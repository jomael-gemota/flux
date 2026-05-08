import type { Skill } from '../types';

export const skill: Skill = {
    name: 'teams-read',
    title: 'Microsoft Teams — Read Messages',
    summary: 'Fetch recent messages from a Microsoft Teams channel or thread.',
    whenToUse:
        'Use when the user wants to read or process messages from a Teams channel ' +
        '— e.g. "get the last 10 messages from the Engineering channel".',
    keywords: ['teams', 'microsoft', 'read', 'fetch', 'messages', 'channel', 'thread'],
    category: 'integration',
    nodeType: 'teams',
    requiresCredential: 'teams',
    body: `
# Microsoft Teams — Read Messages

Fetches recent messages from a Teams channel or reads a specific thread.

## Required config
- \`credentialId\` (string): Connected Teams credential id.
  Call \`list_credentials({ provider: "teams" })\` to find it.
- \`action\` (string): \`"read_messages"\` or \`"read_thread"\`.
- \`teamId\` (string): Teams team id.
  Call \`list_teams\` and present via \`ask_user\`.
- \`channelId\` (string): Channel id within the team.
  Call \`list_teams_channels\` and present via \`ask_user\`.

## For \`read_thread\` — additional required
- \`messageId\` (string): The parent message id to read replies for.

## Optional config
- \`limit\` (number): Max messages to return (default 20).

## Output fields
- \`messages\`: Array of \`{ id, body, from, createdDateTime }\`
- \`count\`: Number of messages returned

## Fluxelle workflow
1. Call \`list_credentials({ provider: "teams" })\` → resolve \`credentialId\`.
2. Call \`list_teams\` → present via \`ask_user\` to pick the team.
3. Call \`list_teams_channels\` → present via \`ask_user\` to pick the channel.
4. Ask how many messages to fetch.

## Example
\`\`\`json
{
  "id": "teams-read-1",
  "type": "teams",
  "name": "Read Engineering Channel",
  "config": {
    "credentialId": "<resolved-from-list_credentials>",
    "action": "read_messages",
    "teamId": "<resolved-from-list_teams>",
    "channelId": "<resolved-from-list_teams_channels>",
    "limit": 20
  },
  "next": []
}
\`\`\`
`,
};
