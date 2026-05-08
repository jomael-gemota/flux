import type { Skill } from '../types';

export const skill: Skill = {
    name: 'gdrive',
    title: 'Google Drive — Manage Files & Folders',
    summary: 'List, upload, download, copy, move, share, rename, or delete files and folders in Google Drive.',
    whenToUse:
        'Use for any Google Drive operation — finding files, uploading content, downloading files, ' +
        'sharing with collaborators, creating folders, or moving items between folders.',
    keywords: [
        'drive', 'google drive', 'file', 'folder', 'upload', 'download', 'share',
        'copy', 'move', 'rename', 'delete', 'create', 'gdrive',
    ],
    category: 'integration',
    nodeType: 'gdrive',
    requiresCredential: 'google',
    body: `
# Google Drive — Manage Files & Folders

Full-suite Google Drive integration: list, upload, download, copy, move,
share, rename, and delete files and folders.

## Required config (all actions)
- \`credentialId\` (string): Connected Google credential id.
  Call \`list_credentials({ provider: "google" })\` to find it.
- \`action\` (string): One of the actions listed below.

---

## Action: \`"list"\`
Search files/folders in Drive.
- \`searchQuery\` (string): Plain-text search term.
- \`searchFolderId\` (string, optional): Limit search to a folder.
  Call \`list_gdrive_items\` and present via \`ask_user\`.
- \`includeType\` (\`"files" | "folders" | "both"\`): Default \`"both"\`.
- \`fileTypes\` (string[]): Filter by \`"image"\`, \`"pdf"\`, \`"docs"\`, \`"sheets"\`, \`"slides"\`, \`"video"\`.
- \`maxResults\` (number): Default 20.

## Action: \`"upload"\`
Upload content to Drive.
- \`uploadSource\` (\`"content" | "local"\`):
  - \`"content"\` — text/expression in \`uploadContent\`.
  - \`"local"\` — base64 in \`uploadData\` (from another node).
- \`uploadFileName\` (string): Filename with extension.
- \`destinationFolderId\` (string, optional): Target folder.

## Action: \`"download"\`
Download a file from Drive (returns base64 content).
- \`downloadFolderId\` + \`downloadFileName\` — search by name.
- OR \`fileId\` — direct file reference.
- OR \`driveUrl\` — paste the share URL and the file id is extracted automatically.

## Action: \`"create_file"\`
Create a new file with text content.
- \`fileName\`, \`content\` (string), \`mimeType\` (string), \`folderId\` (string, optional).

## Action: \`"copy_file"\` / \`"move_file"\`
- \`fileId\` (string): Source file.
- \`destinationFolderId\` (string): Target folder.
- \`newName\` (string, optional): Rename on copy.

## Action: \`"rename_file"\`
- \`fileId\` (string), \`newName\` (string).

## Action: \`"delete_file"\`
- \`fileId\` (string), \`permanent\` (boolean, default \`false\` = trash).

## Action: \`"share_file"\` / \`"share_folder"\`
- \`fileId\` or \`folderId\` (string).
- \`shareEmail\` (string): Recipient email.
- \`shareRole\` (\`"reader" | "commenter" | "writer"\`).
- \`shareMode\` (\`"grant" | "restrict"\`): Default \`"grant"\`.

## Action: \`"create_folder"\`
- \`fileName\` (string): Folder name.
- \`folderId\` (string, optional): Parent folder.

## Action: \`"delete_folder"\`
- \`folderId\` (string), \`permanent\` (boolean).

## Output fields
Varies by action:
- **list**: \`files\` (array of \`{ id, name, mimeType, size, modifiedTime }\`), \`count\`
- **download**: \`fileContent\` (base64), \`fileName\`, \`mimeType\`
- **upload / create_file**: \`fileId\`, \`fileName\`, \`webViewLink\`
- **share**: \`permissionId\`

## Fluxelle workflow
1. Call \`list_credentials({ provider: "google" })\` → resolve \`credentialId\`.
2. Use \`ask_user\` to clarify the action if the user described it vaguely.
3. Call \`list_gdrive_items\` to resolve folder or file references where applicable.
4. Ask for share recipient email or upload content as needed.

## Example — download a file by name
\`\`\`json
{
  "id": "gdrive-1",
  "type": "gdrive",
  "name": "Download Report PDF",
  "config": {
    "credentialId": "<resolved-from-list_credentials>",
    "action": "download",
    "downloadFolderId": "<resolved-from-list_gdrive_items>",
    "downloadFileName": "Monthly Report.pdf"
  },
  "next": []
}
\`\`\`
`,
};
