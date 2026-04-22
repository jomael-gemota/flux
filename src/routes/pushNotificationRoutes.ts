/**
 * Push notification ingress routes
 *
 * These endpoints are called by EXTERNAL SERVICES (Google, Basecamp, …)
 * when an event fires for a subscribed workflow trigger.
 *
 * They are deliberately lightweight: all they do is call pollingService.pollOnce()
 * which reuses the existing poll/compare/trigger logic.
 *
 * Route prefix: /push  (registered without /api prefix so external services can reach it)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PollingService }           from '../services/PollingService';
import { PushSubscriptionService }  from '../services/PushSubscriptionService';

interface PushRouteOptions {
    pollingService:          PollingService;
    pushSubscriptionService: PushSubscriptionService;
}

export async function pushNotificationRoutes(
    app:     FastifyInstance,
    options: PushRouteOptions,
): Promise<void> {
    const { pollingService, pushSubscriptionService } = options;

    // ── Google Drive / Sheets ─────────────────────────────────────────────────
    //
    // Google sends a POST whenever the watched file/folder changes.
    // The body is EMPTY — all info comes in headers.
    //
    // Key headers:
    //   X-Goog-Resource-State  : "sync" (initial) | "change" | "update" | …
    //   X-Goog-Channel-ID      : the channel UUID we supplied during registration
    //   X-Goog-Changed         : comma-separated list of changed aspects (content, …)

    app.post(
        '/push/gdrive/:workflowId/:nodeId',
        async (
            req: FastifyRequest<{ Params: { workflowId: string; nodeId: string } }>,
            reply: FastifyReply,
        ) => {
            const { workflowId, nodeId } = req.params;
            const resourceState = (req.headers['x-goog-resource-state'] as string) ?? '';

            // Google sends 'sync' as a handshake on subscription creation — acknowledge only.
            if (pushSubscriptionService.isGDriveSyncMessage(resourceState)) {
                return reply.status(200).send();
            }

            // Fire an immediate poll so the workflow triggers without waiting for the
            // next 1-minute fallback cycle.
            pollingService.pollOnce(workflowId, nodeId).catch((err) =>
                console.error('[push/gdrive] pollOnce error:', err),
            );

            // Respond 200 quickly — Google requires a timely ACK.
            return reply.status(200).send();
        },
    );

    // ── Basecamp ──────────────────────────────────────────────────────────────
    //
    // Basecamp sends a POST with the full event JSON in the body.
    // We can trigger an immediate poll (which will compare timestamps / IDs
    // and avoid duplicates) rather than parsing the Basecamp payload ourselves.

    app.post(
        '/push/basecamp/:workflowId/:nodeId',
        async (
            req: FastifyRequest<{ Params: { workflowId: string; nodeId: string } }>,
            reply: FastifyReply,
        ) => {
            const { workflowId, nodeId } = req.params;

            pollingService.pollOnce(workflowId, nodeId).catch((err) =>
                console.error('[push/basecamp] pollOnce error:', err),
            );

            return reply.status(200).send();
        },
    );
}
