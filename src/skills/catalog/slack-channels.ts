import type { Skill } from '../types';

export const skill: Skill = {
    name: 'slack-channels',
    title: 'Slack — List Channels & Users',
    summary:
        'List all, public, or private Slack channels in a workspace, or list all workspace members.',
    whenToUse:
        'Use when the user wants to enumerate Slack channels (all, public-only, or private-only) ' +
        'or list workspace members as part of a workflow — e.g. "get all private channels", ' +
        '"list every Slack user", "show me all channels with their member counts", or when ' +
        'building a workflow that needs to iterate over channels or users dynamically.',
    keywords: [
        'slack', 'list', 'channels', 'users', 'members', 'workspace',
        'public', 'private', 'enumerate', 'discovery', 'audit',
        'conversation', 'history', 'all channels',
    ],
    category: 'integration',
    nodeType: 'slack',
    requiresCredential: 'slack',
    body: `
# Slack — List Channels & Users

Two actions for workspace discovery:
- **\`list_channels\`** — returns every channel the credential can see, with optional filtering.
- **\`list_users\`** — returns every non-deleted member of the workspace.

---

## Action: list_channels

### Required config
- \`credentialId\` (string): Connected Slack credential id.
  Call \`list_credentials({ provider: "slack" })\` to find it.
- \`action\` (string): \`"list_channels"\`

### Optional config
- \`channelFilter\` (\`"all" | "public" | "private"\`): Which channel types to return.
  Defaults to \`"all"\`. Use \`"public"\` or \`"private"\` to narrow results.
  > ⚠️ Listing **private** channels requires the \`groups:read\` scope on the credential's
  > Slack app. If the scope is missing, the node returns a \`missingScopes\` warning but
  > still succeeds for the types it can access.

### Output fields
- \`channels\`: Array of \`{ id, name, isPrivate, isMember, memberCount }\`
  - \`id\`: Slack channel ID (e.g. \`"C0123ABC"\`) — use this in downstream send/read nodes.
  - \`name\`: Human-readable channel name without the \`#\` prefix.
  - \`isPrivate\`: \`true\` for private channels.
  - \`isMember\`: \`true\` if the connected credential's bot/user is a member.
  - \`memberCount\`: Number of members in the channel (may be \`undefined\` for private channels).
- \`total\`: Total number of channels returned.
- \`missingScopes\`: Array of scope names that were needed but absent (only present when partial).

### Example — list all channels
\`\`\`json
{
  "id": "slack-list-channels-1",
  "type": "slack",
  "name": "List All Channels",
  "config": {
    "credentialId": "<resolved-from-list_credentials>",
    "action": "list_channels",
    "channelFilter": "all"
  },
  "next": []
}
\`\`\`

### Example — list only private channels
\`\`\`json
{
  "id": "slack-list-channels-1",
  "type": "slack",
  "name": "List Private Channels",
  "config": {
    "credentialId": "<resolved-from-list_credentials>",
    "action": "list_channels",
    "channelFilter": "private"
  },
  "next": []
}
\`\`\`

Downstream: reference channels as \`{{ nodes.slack-list-channels-1.channels }}\`.

---

## Action: list_users

### Required config
- \`credentialId\` (string): Connected Slack credential id.
- \`action\` (string): \`"list_users"\`

### Output fields
- \`users\`: Array of \`{ id, name, realName, displayName, email, isBot }\`
  - \`id\`: Slack user ID — use this in \`send_dm\`, \`read_messages\` (DM source), etc.
  - \`displayName\`: The name shown in the Slack UI.
  - \`email\`: Workspace email (requires \`users:read.email\` scope; may be absent).
  - \`isBot\`: \`true\` for bot users.
- \`total\`: Total number of users returned.

### Example — list workspace members
\`\`\`json
{
  "id": "slack-list-users-1",
  "type": "slack",
  "name": "List Workspace Users",
  "config": {
    "credentialId": "<resolved-from-list_credentials>",
    "action": "list_users"
  },
  "next": []
}
\`\`\`

Downstream: reference users as \`{{ nodes.slack-list-users-1.users }}\`.

---

## Fluxelle workflow — list channels

1. Call \`list_credentials({ provider: "slack" })\` → resolve \`credentialId\`.
2. Ask the user whether they want all, public-only, or private-only channels
   using \`ask_user\` with three options.
3. Propose a \`list_channels\` node with the chosen \`channelFilter\`.
4. If the workflow continues (e.g. looping over channels to read messages),
   wire the output into a \`loop\` node and use
   \`{{ nodes.slack-list-channels-1.channels }}\` as the loop array.

## Fluxelle workflow — list users

1. Call \`list_credentials({ provider: "slack" })\` → resolve \`credentialId\`.
2. Propose a \`list_users\` node.
3. To filter bots, wire into a \`transform\` or \`code\` node and filter on \`isBot === false\`.

## Common patterns

### Audit all private channels
Trigger (manual) → list_channels (private) → formatter → send to owner via DM

### Daily member count report
Trigger (cron) → list_channels (all) → code (summarise counts) → send_message (#ops)

### DM every user in the workspace
Trigger (manual) → list_users → loop (over users) → send_dm ({{ loop.item.id }})
`,
};
