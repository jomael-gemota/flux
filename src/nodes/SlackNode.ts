import { WebClient } from '@slack/web-api';
import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { SlackAuthService } from '../services/SlackAuthService';
import { ExpressionResolver } from '../engine/ExpressionResolver';

type SlackAction = 'send_message' | 'send_dm' | 'upload_file' | 'read_messages';

interface SlackConfig {
    credentialId: string;
    action: SlackAction;
    // send_message / send_dm
    channel?: string;
    userId?: string;
    text?: string;
    // upload_file
    filename?: string;
    fileContent?: string;
    // read_messages
    limit?: number;
}

export class SlackNode implements NodeExecutor {
    private slackAuth: SlackAuthService;
    private resolver = new ExpressionResolver();

    constructor(slackAuth: SlackAuthService) {
        this.slackAuth = slackAuth;
    }

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        const config = node.config as unknown as SlackConfig;
        const { credentialId, action } = config;

        if (!credentialId) throw new Error('Slack node: credentialId is required');
        if (!action)       throw new Error('Slack node: action is required');

        const token  = await this.slackAuth.getBotToken(credentialId);
        const client = new WebClient(token);

        if (action === 'send_message') {
            const channel = this.resolver.resolveTemplate(config.channel ?? '', context);
            const text    = this.resolver.resolveTemplate(config.text ?? '', context);

            if (!channel) throw new Error('Slack send_message: channel is required');
            if (!text)    throw new Error('Slack send_message: text is required');

            const res = await client.chat.postMessage({ channel, text });
            return {
                ok:        res.ok,
                ts:        res.ts,
                channel:   res.channel,
                messageId: res.ts,
            };
        }

        if (action === 'send_dm') {
            const userId = this.resolver.resolveTemplate(config.userId ?? '', context);
            const text   = this.resolver.resolveTemplate(config.text ?? '', context);

            if (!userId) throw new Error('Slack send_dm: userId is required');
            if (!text)   throw new Error('Slack send_dm: text is required');

            // Open (or reuse) a DM channel with the user
            const conv = await client.conversations.open({ users: userId });
            if (!conv.ok || !conv.channel?.id) {
                throw new Error(`Slack send_dm: failed to open DM with user "${userId}"`);
            }

            const res = await client.chat.postMessage({ channel: conv.channel.id, text });
            return {
                ok:        res.ok,
                ts:        res.ts,
                channel:   res.channel,
                messageId: res.ts,
            };
        }

        if (action === 'upload_file') {
            const channel     = this.resolver.resolveTemplate(config.channel ?? '', context);
            const filename    = this.resolver.resolveTemplate(config.filename ?? 'file.txt', context);
            const fileContent = this.resolver.resolveTemplate(config.fileContent ?? '', context);

            if (!fileContent) throw new Error('Slack upload_file: fileContent is required');

            // Use the current Slack file upload API
            const uploadRes = await client.files.getUploadURLExternal({
                filename,
                length: Buffer.byteLength(fileContent, 'utf-8'),
            });

            if (!uploadRes.ok || !uploadRes.upload_url || !uploadRes.file_id) {
                throw new Error('Slack upload_file: failed to get upload URL');
            }

            // Upload file content to the pre-signed URL
            await fetch(uploadRes.upload_url, {
                method:  'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body:    fileContent,
            });

            // Complete the upload — SDK requires a non-empty tuple
            const completeParams: Parameters<typeof client.files.completeUploadExternal>[0] = {
                files: [{ id: uploadRes.file_id, title: filename }],
                ...(channel ? { channel_id: channel } : {}),
            };
            const completeRes = await client.files.completeUploadExternal(completeParams);

            return {
                ok:     completeRes.ok,
                fileId: uploadRes.file_id,
                filename,
            };
        }

        if (action === 'read_messages') {
            const channel = this.resolver.resolveTemplate(config.channel ?? '', context);
            const limit   = config.limit ?? 10;

            if (!channel) throw new Error('Slack read_messages: channel is required');

            const res = await client.conversations.history({ channel, limit });
            const messages = (res.messages ?? []).map((m) => {
                const raw = m as Record<string, unknown>;
                return {
                    ts:         m.ts,
                    text:       m.text,
                    user:       m.user,
                    type:       m.type,
                    botId:      m.bot_id,
                    // Thread info: replyCount > 0 means this message started a thread
                    replyCount: typeof raw.reply_count === 'number' ? raw.reply_count : undefined,
                    threadTs:   typeof raw.thread_ts   === 'string' ? raw.thread_ts   : undefined,
                };
            });

            return {
                ok:       res.ok,
                messages,
                hasMore:  res.has_more,
            };
        }

        throw new Error(`Slack node: unknown action "${action}"`);
    }
}
