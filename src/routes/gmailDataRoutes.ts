import { FastifyInstance } from 'fastify';
import { google } from 'googleapis';
import { GoogleAuthService } from '../services/GoogleAuthService';

export async function gmailDataRoutes(
    fastify: FastifyInstance,
    options: { googleAuth: GoogleAuthService }
): Promise<void> {
    const { googleAuth } = options;

    /**
     * GET /gmail/labels?credentialId=xxx
     * Returns all labels (system + user-created) for the connected Gmail account.
     */
    fastify.get<{ Querystring: { credentialId: string } }>(
        '/gmail/labels',
        async (request, reply) => {
            const { credentialId } = request.query;
            if (!credentialId) return reply.badRequest('credentialId is required');

            const auth  = await googleAuth.getAuthenticatedClient(credentialId);
            const gmail = google.gmail({ version: 'v1', auth });

            const res = await gmail.users.labels.list({ userId: 'me' });

            const labels = (res.data.labels ?? []).map((l) => ({
                id:   l.id   ?? '',
                name: l.name ?? '',
                type: l.type ?? 'user',   // 'system' | 'user'
            }));

            // System labels first (sorted by name), then user labels alphabetically
            labels.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'system' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

            return reply.send(labels);
        }
    );

    /**
     * GET /gmail/message/labels?credentialId=xxx&messageId=yyy
     * Returns only the labels currently applied to a specific message,
     * enriched with their human-readable names from labels.list.
     */
    fastify.get<{ Querystring: { credentialId: string; messageId: string } }>(
        '/gmail/message/labels',
        async (request, reply) => {
            const { credentialId, messageId } = request.query;
            if (!credentialId) return reply.badRequest('credentialId is required');
            if (!messageId)    return reply.badRequest('messageId is required');

            const auth  = await googleAuth.getAuthenticatedClient(credentialId);
            const gmail = google.gmail({ version: 'v1', auth });

            // Fetch both in parallel — message metadata and full label catalogue
            const [msgRes, allLabelsRes] = await Promise.all([
                gmail.users.messages.get({ userId: 'me', id: messageId, format: 'metadata' }),
                gmail.users.labels.list({ userId: 'me' }),
            ]);

            const msgLabelIds  = msgRes.data.labelIds ?? [];
            const allLabels    = allLabelsRes.data.labels ?? [];
            const labelMap     = new Map(allLabels.map((l) => [l.id!, { name: l.name ?? l.id!, type: l.type ?? 'user' }]));

            const labels = msgLabelIds
                .map((id) => ({
                    id,
                    name: labelMap.get(id)?.name ?? id,
                    type: labelMap.get(id)?.type ?? 'user',
                }))
                .sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'system' ? -1 : 1;
                    return a.name.localeCompare(b.name);
                });

            return reply.send(labels);
        }
    );
}
