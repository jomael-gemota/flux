import { google } from 'googleapis';
import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { ExpressionResolver } from '../engine/ExpressionResolver';

type GmailAction = 'send' | 'list' | 'read';

interface GmailConfig {
    credentialId: string;
    action: GmailAction;
    // send — to/cc/bcc accept a string (legacy) or array of addresses
    to?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject?: string;
    body?: string;
    isHtml?: boolean;
    // list — user-friendly filter fields (translated to a Gmail query on the fly)
    readStatus?: 'all' | 'read' | 'unread';
    fromFilter?: string | string[];   // single address/name, or multiple (joined with OR)
    subjectFilter?: string;
    bodyFilter?: string;
    hasAttachment?: boolean;
    attachmentTypes?: string[];   // 'image' | 'pdf' | 'docs' | 'sheets'
    maxResults?: number;
    // read
    messageId?: string;
}

export class GmailNode implements NodeExecutor {
    private googleAuth: GoogleAuthService;
    private resolver = new ExpressionResolver();

    constructor(googleAuth: GoogleAuthService) {
        this.googleAuth = googleAuth;
    }

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        const config = node.config as unknown as GmailConfig;
        const { credentialId, action } = config;

        if (!credentialId) throw new Error('Gmail node: credentialId is required');
        if (!action)       throw new Error('Gmail node: action is required');

        const auth   = await this.googleAuth.getAuthenticatedClient(credentialId);
        const gmail  = google.gmail({ version: 'v1', auth });

        // Helper: resolve a to/cc/bcc value that may be a string or string array.
        const resolveAddresses = (raw: string | string[] | undefined): string | undefined => {
            if (!raw) return undefined;
            if (Array.isArray(raw)) {
                const resolved = raw
                    .map((a) => this.resolver.resolveTemplate(a, context))
                    .filter(Boolean)
                    .join(', ');
                return resolved || undefined;
            }
            const resolved = this.resolver.resolveTemplate(raw, context);
            return resolved || undefined;
        };

        if (action === 'send') {
            const to      = resolveAddresses(config.to) ?? '';
            const subject = this.resolver.resolveTemplate(config.subject ?? '', context);
            const body    = this.resolver.resolveTemplate(config.body ?? '', context);
            const cc      = resolveAddresses(config.cc);
            const bcc     = resolveAddresses(config.bcc);

            const contentType = config.isHtml ? 'text/html' : 'text/plain';

            // Normalise line endings inside the body to CRLF so every paragraph
            // boundary survives the MIME encode/decode cycle intact.
            const normalisedBody = body.replace(/\r?\n/g, '\r\n');

            // IMPORTANT: filter only null/undefined, NOT the empty string ''.
            // The empty string is the mandatory blank line that separates MIME
            // headers from the body.  filter(Boolean) would remove it, causing
            // the first paragraph to be parsed as a malformed header and only
            // the text after the first \n\n to appear as the email body.
            const messageParts = [
                `To: ${to}`,
                cc  ? `Cc: ${cc}`  : null,
                bcc ? `Bcc: ${bcc}` : null,
                `Subject: ${subject}`,
                `Content-Type: ${contentType}; charset=utf-8`,
                '',              // ← blank line — MIME header/body separator
                normalisedBody,
            ];
            const rawMessage = messageParts
                .filter((line): line is string => line !== null)
                .join('\r\n');

            const encoded = Buffer.from(rawMessage).toString('base64url');
            const res = await gmail.users.messages.send({
                userId: 'me',
                requestBody: { raw: encoded },
            });
            return { messageId: res.data.id, threadId: res.data.threadId, labelIds: res.data.labelIds };
        }

        if (action === 'list') {
            const maxResults = config.maxResults ?? 10;

            // Shared body-extraction helper (mirrors the 'read' action logic).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const getPart = (parts: any[] | null | undefined, mimeType: string): string => {
                for (const part of parts ?? []) {
                    if (part.mimeType === mimeType && part.body?.data) {
                        return Buffer.from(part.body.data, 'base64').toString('utf-8');
                    }
                    if (part.parts) {
                        const found = getPart(part.parts, mimeType);
                        if (found) return found;
                    }
                }
                return '';
            };

            // Build a Gmail search query from the user-friendly filter fields.
            const queryParts: string[] = [];

            if (config.readStatus === 'read')   queryParts.push('is:read');
            if (config.readStatus === 'unread') queryParts.push('is:unread');

            // fromFilter may be a single string or an array of addresses/names
            const resolvedFroms: string[] = Array.isArray(config.fromFilter)
                ? config.fromFilter
                    .map((f) => this.resolver.resolveTemplate(f, context))
                    .filter(Boolean)
                : config.fromFilter
                    ? [this.resolver.resolveTemplate(config.fromFilter, context)].filter(Boolean)
                    : [];

            const subjectFilter = config.subjectFilter ? this.resolver.resolveTemplate(config.subjectFilter, context) : '';
            const bodyFilter    = config.bodyFilter    ? this.resolver.resolveTemplate(config.bodyFilter, context)    : '';

            if (resolvedFroms.length === 1) {
                queryParts.push(`from:(${resolvedFroms[0]})`);
            } else if (resolvedFroms.length > 1) {
                // Multiple senders: match emails from ANY of them
                queryParts.push(`{${resolvedFroms.map((f) => `from:${f}`).join(' ')}}`);
            }
            if (subjectFilter) queryParts.push(`subject:(${subjectFilter})`);
            if (bodyFilter)    queryParts.push(`"${bodyFilter}"`);

            if (config.hasAttachment) {
                queryParts.push('has:attachment');
                const typeMap: Record<string, string> = {
                    image:  'filename:(jpg OR jpeg OR png OR gif OR bmp OR webp)',
                    pdf:    'filename:pdf',
                    docs:   'filename:(doc OR docx)',
                    sheets: 'filename:(xls OR xlsx OR csv)',
                };
                (config.attachmentTypes ?? []).forEach((t) => {
                    if (typeMap[t]) queryParts.push(typeMap[t]);
                });
            }

            const query = queryParts.join(' ');

            // Step 1: run the search to find messages matching the filters
            const res = await gmail.users.messages.list({
                userId: 'me',
                q: query || undefined,
                maxResults,
            });
            const matchedRefs = res.data.messages ?? [];

            // Step 2: collect unique thread IDs from the matched messages
            const seenThreadIds = new Set<string>();
            for (const m of matchedRefs) {
                if (m.threadId) seenThreadIds.add(m.threadId);
            }

            // Step 3: fetch every thread in full so the caller gets the complete
            //         conversation, including the full body of every message.
            const threads = await Promise.all(
                [...seenThreadIds].map(async (threadId) => {
                    const thread = await gmail.users.threads.get({
                        userId: 'me',
                        id: threadId,
                        format: 'full',   // full payload so we can decode the body
                    });
                    const msgs = (thread.data.messages ?? []).map((m) => {
                        const headers = m.payload?.headers ?? [];
                        const h = (name: string) =>
                            headers.find((x) => x.name === name)?.value ?? '';

                        // Extract the complete plain-text (or HTML) body
                        const body =
                            getPart(m.payload?.parts, 'text/plain') ||
                            getPart(m.payload?.parts, 'text/html') ||
                            (m.payload?.body?.data
                                ? Buffer.from(m.payload.body.data, 'base64').toString('utf-8')
                                : '');

                        return {
                            id:       m.id,
                            threadId: m.threadId ?? threadId,
                            subject:  h('Subject'),
                            from:     h('From'),
                            to:       h('To'),
                            date:     h('Date'),
                            snippet:  m.snippet,
                            body,
                        };
                    });
                    return { threadId, messages: msgs };
                })
            );

            const totalMessages = threads.reduce((s, t) => s + t.messages.length, 0);
            return {
                threads,
                totalThreads:    threads.length,
                totalMessages,
                matchedMessages: matchedRefs.length,
            };
        }

        if (action === 'read') {
            const messageId = this.resolver.resolveTemplate(config.messageId ?? '', context);
            if (!messageId) throw new Error('Gmail read: messageId is required');

            const res = await gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full',
            });
            const payload  = res.data.payload;
            const headers  = payload?.headers ?? [];
            const h = (name: string) => headers.find((x) => x.name === name)?.value ?? '';

            // Extract plain-text body
            let textBody = '';
            type MsgParts = NonNullable<typeof payload>['parts'];
            const getPart = (parts: MsgParts, mimeType: string): string => {
                for (const part of parts ?? []) {
                    if (part.mimeType === mimeType && part.body?.data) {
                        return Buffer.from(part.body.data, 'base64').toString('utf-8');
                    }
                    if (part.parts) {
                        const found = getPart(part.parts, mimeType);
                        if (found) return found;
                    }
                }
                return '';
            };

            textBody = getPart(payload?.parts, 'text/plain') ||
                       getPart(payload?.parts, 'text/html') ||
                       (payload?.body?.data ? Buffer.from(payload.body.data, 'base64').toString('utf-8') : '');

            return {
                id:       res.data.id,
                threadId: res.data.threadId,
                subject:  h('Subject'),
                from:     h('From'),
                to:       h('To'),
                date:     h('Date'),
                snippet:  res.data.snippet,
                body:     textBody,
                labelIds: res.data.labelIds,
            };
        }

        throw new Error(`Gmail node: unknown action "${action}"`);
    }
}
