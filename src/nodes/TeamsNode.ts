import { Client } from '@microsoft/microsoft-graph-client';
import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { TeamsAuthService } from '../services/TeamsAuthService';
import { ExpressionResolver } from '../engine/ExpressionResolver';

type TeamsAction = 'send_message' | 'send_dm' | 'read_messages' | 'read_thread';

interface TeamsConfig {
    credentialId: string;
    action: TeamsAction;
    // send_message / read_messages / read_thread
    teamId?: string;
    channelId?: string;
    // send_message / send_dm
    text?: string;
    // send_dm
    userId?: string;
    // read_messages
    limit?: number;
    // read_thread
    messageId?: string;
}

/**
 * Strip HTML tags from a Teams message body and decode common HTML entities.
 * Teams returns `contentType: "html"` for most messages.
 */
function stripHtml(html: string): string {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export class TeamsNode implements NodeExecutor {
    private teamsAuth: TeamsAuthService;
    private resolver = new ExpressionResolver();

    constructor(teamsAuth: TeamsAuthService) {
        this.teamsAuth = teamsAuth;
    }

    private async getClient(credentialId: string): Promise<Client> {
        const token = await this.teamsAuth.getToken(credentialId);
        return Client.init({
            authProvider: (done) => done(null, token),
        });
    }

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        const config = node.config as unknown as TeamsConfig;
        const { credentialId, action } = config;

        if (!credentialId) throw new Error('Teams node: credentialId is required');
        if (!action)       throw new Error('Teams node: action is required');

        const client = await this.getClient(credentialId);

        if (action === 'send_message') {
            const teamId    = this.resolver.resolveTemplate(config.teamId    ?? '', context);
            const channelId = this.resolver.resolveTemplate(config.channelId ?? '', context);
            const text      = this.resolver.resolveTemplate(config.text      ?? '', context);

            if (!teamId)    throw new Error('Teams send_message: teamId is required');
            if (!channelId) throw new Error('Teams send_message: channelId is required');
            if (!text)      throw new Error('Teams send_message: text is required');

            const res = await client
                .api(`/teams/${teamId}/channels/${channelId}/messages`)
                .post({
                    body: {
                        contentType: 'text',
                        content:     text,
                    },
                });

            return {
                id:        res.id,
                teamId,
                channelId,
                createdAt: res.createdDateTime,
            };
        }

        if (action === 'send_dm') {
            const userId = this.resolver.resolveTemplate(config.userId ?? '', context);
            const text   = this.resolver.resolveTemplate(config.text   ?? '', context);

            if (!userId) throw new Error('Teams send_dm: userId is required');
            if (!text)   throw new Error('Teams send_dm: text is required');

            // Get or create a 1:1 chat with the target user.
            // First resolve the current user's ID.
            const me = await client.api('/me').get() as { id: string };

            const chat = await client.api('/chats').post({
                chatType: 'oneOnOne',
                members: [
                    {
                        '@odata.type':     '#microsoft.graph.aadUserConversationMember',
                        roles:             ['owner'],
                        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${me.id}')`,
                    },
                    {
                        '@odata.type':     '#microsoft.graph.aadUserConversationMember',
                        roles:             ['owner'],
                        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${userId}')`,
                    },
                ],
            }) as { id: string };

            const message = await client.api(`/chats/${chat.id}/messages`).post({
                body: {
                    contentType: 'text',
                    content:     text,
                },
            }) as { id: string; createdDateTime: string };

            return {
                id:        message.id,
                chatId:    chat.id,
                createdAt: message.createdDateTime,
            };
        }

        if (action === 'read_messages') {
            const teamId    = this.resolver.resolveTemplate(config.teamId    ?? '', context);
            const channelId = this.resolver.resolveTemplate(config.channelId ?? '', context);
            const limit     = config.limit ?? 10;

            if (!teamId)    throw new Error('Teams read_messages: teamId is required');
            if (!channelId) throw new Error('Teams read_messages: channelId is required');

            const res = await client
                .api(`/teams/${teamId}/channels/${channelId}/messages`)
                .top(limit)
                .get() as { value: Array<Record<string, unknown>> };

            // Graph returns messages newest-first; sort ascending so oldest appears at top.
            const messages = (res.value ?? [])
                .map((m) => {
                    const body        = m.body as { content?: string; contentType?: string } | undefined;
                    const rawContent  = body?.content ?? '';
                    const contentType = body?.contentType ?? 'text';
                    const text        = contentType === 'html' ? stripHtml(rawContent) : rawContent;

                    const repliesCollection = m.replies as Array<unknown> | undefined;
                    const replyCount = Array.isArray(repliesCollection) ? repliesCollection.length : undefined;

                    return {
                        id:         m.id,
                        text,
                        from:       (m.from as { user?: { displayName?: string } } | undefined)?.user?.displayName,
                        createdAt:  m.createdDateTime as string | undefined,
                        replyToId:  (m.replyToId as string | null | undefined) ?? undefined,
                        hasReplies: replyCount !== undefined ? replyCount > 0 : undefined,
                        replyCount,
                    };
                })
                .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));

            return { messages, count: messages.length };
        }

        if (action === 'read_thread') {
            const teamId    = this.resolver.resolveTemplate(config.teamId    ?? '', context);
            const channelId = this.resolver.resolveTemplate(config.channelId ?? '', context);
            const messageId = this.resolver.resolveTemplate(config.messageId ?? '', context);

            if (!teamId)    throw new Error('Teams read_thread: teamId is required');
            if (!channelId) throw new Error('Teams read_thread: channelId is required');
            if (!messageId) throw new Error('Teams read_thread: messageId is required');

            const mapMsg = (m: Record<string, unknown>, isParent = false) => {
                const body        = m.body as { content?: string; contentType?: string } | undefined;
                const rawContent  = body?.content ?? '';
                const contentType = body?.contentType ?? 'text';
                const text        = contentType === 'html' ? stripHtml(rawContent) : rawContent;
                return {
                    id:        m.id,
                    text,
                    from:      (m.from as { user?: { displayName?: string } } | undefined)?.user?.displayName,
                    createdAt: m.createdDateTime,
                    isParent,
                };
            };

            const [parentRes, repliesRes] = await Promise.all([
                client
                    .api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}`)
                    .get() as Promise<Record<string, unknown>>,
                client
                    .api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`)
                    .get() as Promise<{ value: Array<Record<string, unknown>> }>,
            ]);

            const parent = mapMsg(parentRes, true);
            // Graph replies may return newest-first; sort ascending so oldest reply appears at top.
            const replies = (repliesRes.value ?? [])
                .map((r) => mapMsg(r))
                .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));

            return { teamId, channelId, messageId, parent, replies, replyCount: replies.length };
        }

        throw new Error(`Teams node: unknown action "${action}"`);
    }
}
