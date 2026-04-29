import type { FastifyInstance } from 'fastify';
import { NotificationSettingsRepository } from '../repositories/NotificationSettingsRepository';
import { EmailNotificationService } from '../services/EmailNotificationService';
import type { JwtPayload } from '../types/auth.types';
import type { WorkflowNotifOverride } from '../db/models/NotificationSettingsModel';

interface NotificationRouteOptions {
    notificationSettingsRepo: NotificationSettingsRepository;
    emailNotificationService: EmailNotificationService;
}

async function requireAuth(req: any, reply: any) {
    await req.jwtVerify();
}

function settingsResponse(settings: any, ownerEmail: string, workflowId?: string) {
    const base = {
        enabled:         settings.enabled,
        notifyOnFailure: settings.notifyOnFailure,
        notifyOnPartial: settings.notifyOnPartial,
        notifyOnSuccess: settings.notifyOnSuccess ?? false,
        recipients:      settings.recipients as string[],
        ownerEmail,
        smtpConfigured:  EmailNotificationService.isConfigured(),
    };

    if (!workflowId) return base;

    const override: WorkflowNotifOverride = (settings.workflowOverrides as Record<string, WorkflowNotifOverride>)?.[workflowId] ?? {
        useCustomRecipients: false,
        recipients: [],
    };

    return { ...base, workflowOverride: override };
}

export async function notificationRoutes(
    fastify: FastifyInstance,
    opts: NotificationRouteOptions,
) {
    const { notificationSettingsRepo, emailNotificationService } = opts;

    /**
     * GET /api/notifications/settings
     * Optional query param: ?workflowId=<id>
     * When workflowId is supplied the response includes a `workflowOverride` field
     * containing the per-workflow recipient override for that workflow.
     */
    fastify.get<{ Querystring: { workflowId?: string } }>(
        '/notifications/settings',
        { preHandler: [requireAuth] },
        async (req) => {
            const user = (req as any).user as JwtPayload;
            const { workflowId } = req.query;

            const settings = await notificationSettingsRepo.get(user.sub);

            // Ensure the owner is in the global recipients list on first load
            if (user.email && !settings.recipients.includes(user.email.toLowerCase())) {
                await notificationSettingsRepo.update(
                    { recipients: [user.email.toLowerCase(), ...settings.recipients] },
                    user.sub,
                );
                settings.recipients = [user.email.toLowerCase(), ...settings.recipients];
            }

            return settingsResponse(settings, user.email, workflowId);
        },
    );

    /** PATCH /api/notifications/settings — update global notification settings */
    fastify.patch<{
        Body: {
            enabled?:         boolean;
            notifyOnFailure?: boolean;
            notifyOnPartial?: boolean;
            notifyOnSuccess?: boolean;
            recipients?:      string[];
        };
    }>(
        '/notifications/settings',
        { preHandler: [requireAuth] },
        async (req) => {
            const user = (req as any).user as JwtPayload;
            const { enabled, notifyOnFailure, notifyOnPartial, notifyOnSuccess, recipients } = req.body;

            const patch: Record<string, unknown> = {};
            if (enabled         !== undefined) patch.enabled         = enabled;
            if (notifyOnFailure !== undefined) patch.notifyOnFailure = notifyOnFailure;
            if (notifyOnPartial !== undefined) patch.notifyOnPartial = notifyOnPartial;
            if (notifyOnSuccess !== undefined) patch.notifyOnSuccess = notifyOnSuccess;
            if (recipients !== undefined) {
                // Clean the list, then enforce that the owner's email is always present
                const ownerEmail = user.email.trim().toLowerCase();
                const cleaned = recipients
                    .map((e) => e.trim().toLowerCase())
                    .filter((e) => e.includes('@'));
                if (!cleaned.includes(ownerEmail)) cleaned.unshift(ownerEmail);
                patch.recipients = cleaned;
            }

            const updated = await notificationSettingsRepo.update(patch as any, user.sub);
            return settingsResponse(updated, user.email);
        },
    );

    /**
     * PATCH /api/notifications/workflows/:workflowId/recipients
     * Save (or clear) the per-workflow recipient override for a single workflow.
     * Body: { useCustomRecipients: boolean; recipients: string[] }
     */
    fastify.patch<{
        Params: { workflowId: string };
        Body:   { useCustomRecipients: boolean; recipients: string[] };
    }>(
        '/notifications/workflows/:workflowId/recipients',
        { preHandler: [requireAuth] },
        async (req) => {
            const user = (req as any).user as JwtPayload;
            const { workflowId } = req.params;
            const { useCustomRecipients, recipients } = req.body;

            // Clean recipients — always keep the owner email present when using custom list
            const ownerEmail = user.email.trim().toLowerCase();
            const cleaned = (recipients ?? [])
                .map((e: string) => e.trim().toLowerCase())
                .filter((e: string) => e.includes('@'));
            if (useCustomRecipients && !cleaned.includes(ownerEmail)) {
                cleaned.unshift(ownerEmail);
            }

            const override: WorkflowNotifOverride = { useCustomRecipients, recipients: cleaned };
            const updated = await notificationSettingsRepo.setWorkflowOverride(user.sub, workflowId, override);
            return settingsResponse(updated, user.email, workflowId);
        },
    );

    /** POST /api/notifications/test — send a test email to a given address */
    fastify.post<{
        Body: { email: string };
    }>(
        '/notifications/test',
        { preHandler: [requireAuth] },
        async (req, reply) => {
            const { email } = req.body;
            if (!email || !email.includes('@')) {
                return reply.code(400).send({ message: 'A valid email address is required.' });
            }
            try {
                await emailNotificationService.sendTestEmail(email);
                return { sent: true };
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                return reply.code(500).send({ message });
            }
        },
    );
}
