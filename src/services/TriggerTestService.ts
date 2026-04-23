/**
 * TriggerTestService
 *
 * When a user clicks "Test this node" on a Trigger node configured as an
 * `app_event`, this service fetches a small, representative sample of the
 * most recent real data from the configured source.  The result is injected
 * into the execution context before `TriggerNode.execute()` runs so the test
 * output looks exactly like what a live trigger would produce.
 */

import { GoogleAuthService } from './GoogleAuthService';
import { SlackAuthService } from './SlackAuthService';
import { TeamsAuthService } from './TeamsAuthService';
import { BasecampAuthService } from './BasecampAuthService';

interface TriggerConfig {
    triggerType?: string;
    appType?: string;
    eventType?: string;
    credentialId?: string;
    // google drive
    fileId?: string;
    folderId?: string;
    // google sheets
    spreadsheetId?: string;
    sheetName?: string;
    // teams
    teamId?: string;
    channelId?: string;
    // slack
    slackChannelId?: string;
    // basecamp
    projectId?: string;
    todolistId?: string;
    // email
    labelFilter?: string;
}

export class TriggerTestService {
    constructor(
        private googleAuth: GoogleAuthService,
        private slackAuth: SlackAuthService,
        private teamsAuth: TeamsAuthService,
        private basecampAuth: BasecampAuthService,
    ) {}

    /**
     * Fetch the most recent data for a trigger configured as an app_event.
     * Returns an object to be spread into `context.variables.input` before
     * `TriggerNode.execute()` is called during a manual test.
     *
     * If the trigger is not an app_event (or config is incomplete), returns {}.
     */
    async fetchLatestSample(config: TriggerConfig): Promise<Record<string, unknown>> {
        if (config.triggerType !== 'app_event' || !config.appType || !config.credentialId) {
            return {};
        }

        const polledAt = new Date().toISOString();

        try {
            let items: Array<Record<string, unknown>> = [];

            switch (config.appType) {
                case 'gsheets':  items = await this.latestGSheets(config);  break;
                case 'gdrive':   items = await this.latestGDrive(config);   break;
                case 'slack':    items = await this.latestSlack(config);    break;
                case 'teams':    items = await this.latestTeams(config);    break;
                case 'basecamp': items = await this.latestBasecamp(config); break;
                case 'gmail':    items = await this.latestGmail(config);    break;
            }

            return { items, count: items.length, polledAt };
        } catch {
            return {};
        }
    }

    // ── Google Sheets ──────────────────────────────────────────────────────────

    private async latestGSheets(config: TriggerConfig): Promise<Array<Record<string, unknown>>> {
        const { credentialId, spreadsheetId, sheetName, eventType } = config;
        if (!credentialId || !spreadsheetId) return [];

        const client = await this.googleAuth.getAuthenticatedClient(credentialId);
        const token = (await client.getAccessToken()).token;
        if (!token) return [];

        const authHdr = { Authorization: `Bearer ${token}` };
        const resolvedSheet = sheetName || 'Sheet1';
        const range = `${encodeURIComponent(resolvedSheet)}!A:Z`;

        const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
            { headers: authHdr },
        );
        if (!res.ok) return [];

        const data = await res.json() as { values?: string[][] };
        const rows = data.values ?? [];
        const headers = rows[0] ?? [];
        const dataRows = rows.slice(1);
        if (dataRows.length === 0) return [];

        const mapRow = (row: string[], index: number, label: string): Record<string, unknown> => {
            const obj: Record<string, unknown> = {
                _rowIndex:      index + 2,
                _eventType:     label,
                _spreadsheetId: spreadsheetId,
                _sheetName:     resolvedSheet,
            };
            headers.forEach((h, j) => { const key = h?.trim(); obj[key || `col${j + 1}`] = row[j] ?? ''; });
            return obj;
        };

        if (eventType === 'row_updated') {
            // Show the last few rows that could have been updated
            const slice = dataRows.slice(-5);
            return slice.map((row, i) => mapRow(row, dataRows.length - slice.length + i, 'row_updated'));
        }

        // row_added / row_added_or_updated — show the last row
        const lastIdx = dataRows.length - 1;
        return [mapRow(dataRows[lastIdx], lastIdx, eventType ?? 'row_added')];
    }

    // ── Google Drive ───────────────────────────────────────────────────────────

    private async latestGDrive(config: TriggerConfig): Promise<Array<Record<string, unknown>>> {
        const { credentialId, eventType, fileId, folderId } = config;
        if (!credentialId) return [];

        const client = await this.googleAuth.getAuthenticatedClient(credentialId);
        const token = (await client.getAccessToken()).token;
        if (!token) return [];

        const authHdr = { Authorization: `Bearer ${token}` };

        if (eventType === 'file_changed' && fileId) {
            const fields = [
                'id', 'name', 'mimeType', 'size', 'modifiedTime', 'createdTime', 'version',
                'lastModifyingUser', 'owners', 'shared', 'sharingUser',
                'webViewLink', 'webContentLink', 'iconLink',
                'description', 'parents',
            ].join(',');
            const res = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${fields}&supportsAllDrives=true`,
                { headers: authHdr },
            );
            if (!res.ok) return [];
            const file = await res.json() as Record<string, unknown>;
            return [{ ...file, _eventType: 'file_changed', _fileId: fileId }];
        }

        if (eventType === 'folder_changed' && folderId) {
            const fileFields = [
                'id', 'name', 'modifiedTime', 'createdTime', 'mimeType', 'size',
                'lastModifyingUser', 'owners', 'shared', 'webViewLink', 'iconLink',
            ].join(',');
            const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
            const res = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${query}` +
                `&fields=files(${fileFields})&orderBy=modifiedTime+desc&pageSize=5` +
                `&supportsAllDrives=true&includeItemsFromAllDrives=true`,
                { headers: authHdr },
            );
            if (!res.ok) return [];
            const data = await res.json() as { files?: Array<Record<string, unknown>> };
            return (data.files ?? []).map((f) => ({ ...f, _eventType: 'folder_changed', _folderId: folderId }));
        }

        return [];
    }

    // ── Slack ──────────────────────────────────────────────────────────────────

    private async latestSlack(config: TriggerConfig): Promise<Array<Record<string, unknown>>> {
        const { credentialId, eventType, slackChannelId } = config;
        if (!credentialId) return [];

        const token = await this.slackAuth.getToken(credentialId);
        const authHdr = { Authorization: `Bearer ${token}` };

        // ── new_user ──────────────────────────────────────────────────────
        if (eventType === 'new_user') {
            const res = await fetch('https://slack.com/api/users.list?limit=10', { headers: authHdr });
            if (!res.ok) return [];
            const data = await res.json() as { members?: Array<Record<string, unknown>> };
            const users = (data.members ?? [])
                .filter((u) => !u.is_bot && u.id !== 'USLACKBOT')
                .sort((a, b) => ((b.updated as number) ?? 0) - ((a.updated as number) ?? 0));
            return users.slice(0, 1).map((u) => ({ ...u, _eventType: 'new_user' }));
        }

        // ── new_public_channel ────────────────────────────────────────────
        if (eventType === 'new_public_channel') {
            const res = await fetch(
                'https://slack.com/api/conversations.list?types=public_channel&exclude_archived=true&limit=10',
                { headers: authHdr },
            );
            if (!res.ok) return [];
            const data = await res.json() as { channels?: Array<Record<string, unknown>> };
            const sorted = (data.channels ?? []).sort(
                (a, b) => ((b.created as number) ?? 0) - ((a.created as number) ?? 0),
            );
            return sorted.slice(0, 1).map((ch) => ({ ...ch, _eventType: 'new_public_channel' }));
        }

        // ── file_public / file_shared ─────────────────────────────────────
        if (eventType === 'file_public' || eventType === 'file_shared') {
            const res = await fetch(
                'https://slack.com/api/files.list?types=all&count=5',
                { headers: authHdr },
            );
            if (!res.ok) return [];
            const data = await res.json() as { files?: Array<Record<string, unknown>> };
            const files = eventType === 'file_public'
                ? (data.files ?? []).filter((f) => f.is_public === true)
                : (data.files ?? []);
            return files.slice(0, 1).map((f) => ({ ...f, _eventType: eventType }));
        }

        // ── Message-based events: fetch last message from target channel ───
        const channelId = slackChannelId || await this.slackFirstChannel(authHdr);
        if (!channelId) return [];

        const histRes = await fetch(
            `https://slack.com/api/conversations.history?channel=${channelId}&limit=10`,
            { headers: authHdr },
        );
        if (!histRes.ok) return [];
        const histData = await histRes.json() as { messages?: Array<Record<string, unknown>> };
        const messages = histData.messages ?? [];

        if (eventType === 'app_mention') {
            const botRes = await fetch('https://slack.com/api/auth.test', { headers: authHdr });
            if (botRes.ok) {
                const botData = await botRes.json() as { user_id?: string };
                const botId = botData.user_id ?? '';
                const mention = messages.find((m) => (m.text as string ?? '').includes(`<@${botId}>`));
                if (mention) return [{ ...mention, _channel: channelId, _eventType: 'app_mention' }];
            }
            // Fallback: return latest message with a note
            return messages.slice(0, 1).map((m) => ({ ...m, _channel: channelId, _eventType: 'app_mention', _note: 'No mention found in recent history; showing latest message' }));
        }

        if (eventType === 'reaction_added') {
            const withReactions = messages.filter(
                (m) => Array.isArray(m.reactions) && (m.reactions as unknown[]).length > 0,
            );
            const base = (withReactions.length > 0 ? withReactions : messages).slice(0, 1);
            return base.flatMap((msg) => {
                const reactions = Array.isArray(msg.reactions)
                    ? (msg.reactions as Array<Record<string, unknown>>)
                    : [];
                if (reactions.length === 0) {
                    return [{ ...msg, _channel: channelId, _eventType: 'reaction_added' }];
                }
                return reactions.map((reaction) => ({
                    ...msg,
                    _channel:       channelId,
                    _eventType:     'reaction_added',
                    _reaction:      reaction,
                    _reactionName:  reaction.name,
                    _reactionCount: reaction.count,
                    _reactionUsers: reaction.users,
                }));
            });
        }

        // any_event / new_message (default)
        return messages.slice(0, 1).map((m) => ({ ...m, _channel: channelId, _eventType: eventType ?? 'new_message' }));
    }

    private async slackFirstChannel(authHdr: Record<string, string>): Promise<string | null> {
        const res = await fetch(
            'https://slack.com/api/conversations.list?types=public_channel&exclude_archived=true&limit=1',
            { headers: authHdr },
        );
        if (!res.ok) return null;
        const data = await res.json() as { channels?: Array<{ id: string }> };
        return (data.channels ?? [])[0]?.id ?? null;
    }

    // ── Microsoft Teams ────────────────────────────────────────────────────────

    private async latestTeams(config: TriggerConfig): Promise<Array<Record<string, unknown>>> {
        const { credentialId, eventType, teamId, channelId } = config;
        if (!credentialId) return [];

        const token = await this.teamsAuth.getToken(credentialId);
        const graphHdr = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

        if (eventType === 'new_channel' && teamId) {
            const res = await fetch(
                `https://graph.microsoft.com/v1.0/teams/${teamId}/channels?$top=10`,
                { headers: graphHdr },
            );
            if (!res.ok) return [];
            const data = await res.json() as { value?: Array<Record<string, unknown>> };
            const sorted = (data.value ?? []).sort((a, b) => {
                const ad = a.createdDateTime as string;
                const bd = b.createdDateTime as string;
                return (bd ?? '') > (ad ?? '') ? 1 : -1;
            });
            return sorted.slice(0, 1).map((ch) => ({ ...ch, _teamId: teamId, _eventType: 'new_channel' }));
        }

        if (eventType === 'new_channel_message' && teamId && channelId) {
            const res = await fetch(
                `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages?$top=5`,
                { headers: graphHdr },
            );
            if (!res.ok) return [];
            const data = await res.json() as { value?: Array<Record<string, unknown>> };
            return (data.value ?? []).slice(0, 1).map((m) => ({ ...m, _eventType: 'new_channel_message' }));
        }

        if (eventType === 'new_chat') {
            const res = await fetch(
                'https://graph.microsoft.com/v1.0/me/chats?$top=5',
                { headers: graphHdr },
            );
            if (!res.ok) return [];
            const data = await res.json() as { value?: Array<Record<string, unknown>> };
            const sorted = (data.value ?? []).sort((a, b) => {
                const ad = a.createdDateTime as string;
                const bd = b.createdDateTime as string;
                return (bd ?? '') > (ad ?? '') ? 1 : -1;
            });
            return sorted.slice(0, 1).map((ch) => ({ ...ch, _eventType: 'new_chat' }));
        }

        if (eventType === 'new_team_member' && teamId) {
            const res = await fetch(
                `https://graph.microsoft.com/v1.0/teams/${teamId}/members?$top=10`,
                { headers: graphHdr },
            );
            if (!res.ok) return [];
            const data = await res.json() as { value?: Array<Record<string, unknown>> };
            const sorted = (data.value ?? []).sort((a, b) => {
                const ad = a.visibleHistoryStartDateTime as string;
                const bd = b.visibleHistoryStartDateTime as string;
                return (bd ?? '') > (ad ?? '') ? 1 : -1;
            });
            return sorted.slice(0, 1).map((m) => ({ ...m, _teamId: teamId, _eventType: 'new_team_member' }));
        }

        // new_chat_message (default)
        const res = await fetch(
            'https://graph.microsoft.com/v1.0/me/chats/getAllMessages?$top=5',
            { headers: graphHdr },
        );
        if (!res.ok) return [];
        const data = await res.json() as { value?: Array<Record<string, unknown>> };
        return (data.value ?? []).slice(0, 1).map((m) => ({ ...m, _eventType: eventType ?? 'new_chat_message' }));
    }

    // ── Basecamp ───────────────────────────────────────────────────────────────

    private async latestBasecamp(config: TriggerConfig): Promise<Array<Record<string, unknown>>> {
        const { credentialId, eventType, projectId, todolistId } = config;
        if (!credentialId) return [];

        const token = await this.basecampAuth.getToken(credentialId);
        const accountId = await this.basecampAuth.getAccountId(credentialId);
        const baseUrl = `https://3.basecampapi.com/${accountId}`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'WorkflowAutomation (hello@example.com)',
        };

        let url = '';
        let _eventType = eventType ?? 'new_todo';

        if (eventType === 'new_todo' && todolistId) {
            url = `${baseUrl}/todolists/${todolistId}/todos.json`;
        } else if (eventType === 'todo_completed' && todolistId) {
            url = `${baseUrl}/todolists/${todolistId}/todos.json?completed=true`;
        } else if (eventType === 'new_message' && projectId) {
            url = `${baseUrl}/buckets/${projectId}/messages.json`;
        } else if (eventType === 'new_comment' && projectId) {
            url = `${baseUrl}/buckets/${projectId}/recordings/comments.json`;
        } else {
            return [];
        }

        const res = await fetch(url, { headers });
        if (!res.ok) return [];
        const items = await res.json() as Array<Record<string, unknown>>;

        // Return the most recent item (Basecamp returns newest first)
        return items.slice(0, 1).map((item) => ({ ...item, _eventType, _todolistId: todolistId, _projectId: projectId }));
    }

    // ── Gmail ──────────────────────────────────────────────────────────────────

    private async latestGmail(config: TriggerConfig): Promise<Array<Record<string, unknown>>> {
        const { credentialId, labelFilter } = config;
        if (!credentialId) return [];

        const client = await this.googleAuth.getAuthenticatedClient(credentialId);
        const token = (await client.getAccessToken()).token;
        if (!token) return [];

        const authHdr = { Authorization: `Bearer ${token}` };
        const q = labelFilter ? `label:${labelFilter}` : 'in:inbox';

        const listRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=1`,
            { headers: authHdr },
        );
        if (!listRes.ok) return [];
        const listData = await listRes.json() as { messages?: Array<{ id: string }> };
        const msgId = (listData.messages ?? [])[0]?.id;
        if (!msgId) return [];

        const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
            { headers: authHdr },
        );
        if (!msgRes.ok) return [];
        const msg = await msgRes.json() as Record<string, unknown>;
        return [{ ...msg, _eventType: 'new_email' }];
    }
}
