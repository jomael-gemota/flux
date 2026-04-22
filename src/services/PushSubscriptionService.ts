/**
 * PushSubscriptionService
 *
 * When a trigger node is set to "Instant" mode this service automatically
 * registers a push-notification subscription with the external service so
 * that the workflow fires the moment an event occurs — no user configuration
 * required.
 *
 * Supported native push (near-zero lag):
 *   • Google Sheets / Google Drive — Drive Files.watch API
 *   • Basecamp                     — Basecamp Webhooks API
 *
 * Unsupported services fall back to fast polling (1-minute interval) which
 * is configured in PollingService when triggerMode === 'instant'.
 */

import crypto from 'crypto';
import { PushSubscriptionModel } from '../db/models/PushSubscriptionModel';
import { WorkflowRepository } from '../repositories/WorkflowRepository';
import { GoogleAuthService } from './GoogleAuthService';
import { BasecampAuthService } from './BasecampAuthService';
import { getBaseUrl } from '../utils/baseUrl';

interface TriggerConfig {
    triggerType?:       string;
    triggerMode?:       'polling' | 'instant';
    appType?:           string;
    eventType?:         string;
    credentialId?:      string;
    fileId?:            string;
    folderId?:          string;
    spreadsheetId?:     string;
    projectId?:         string;
    todolistId?:        string;
}

/** Services that support native push — all others use fast polling. */
const NATIVE_PUSH_SERVICES = new Set(['gsheets', 'gdrive', 'basecamp']);

export class PushSubscriptionService {
    constructor(
        private workflowRepo: WorkflowRepository,
        private googleAuth:   GoogleAuthService,
        private basecampAuth: BasecampAuthService,
    ) {}

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Called whenever a workflow is saved.  Ensures every instant trigger node
     * has an active push subscription and cancels subscriptions for nodes that
     * are no longer in instant mode.
     */
    async syncWorkflow(workflowId: string): Promise<void> {
        const workflow = await this.workflowRepo.findById(workflowId);
        if (!workflow) return;

        const instantNodeIds = new Set<string>();

        for (const node of (workflow.nodes ?? [])) {
            if (node.type !== 'trigger') continue;
            const cfg = node.config as unknown as TriggerConfig;
            if (cfg.triggerMode !== 'instant' || cfg.triggerType !== 'app_event') continue;
            if (!NATIVE_PUSH_SERVICES.has(cfg.appType ?? '')) continue;

            instantNodeIds.add(node.id);
            await this.ensureSubscription(workflowId, node.id, cfg).catch((err) =>
                console.error(`[PushSubscriptionService] subscribe error ${workflowId}::${node.id}:`, err)
            );
        }

        // Cancel subscriptions for nodes no longer in instant mode
        const activeSubs = await PushSubscriptionModel.find({ workflowId, active: true });
        for (const sub of activeSubs) {
            if (!instantNodeIds.has(sub.nodeId)) {
                await this.cancelSubscription(workflowId, sub.nodeId).catch(() => {});
            }
        }
    }

    /**
     * Ensure a push subscription exists for this trigger node.
     * Creates a new one or replaces an expired/stale one.
     */
    async ensureSubscription(
        workflowId: string,
        nodeId:     string,
        config:     TriggerConfig,
    ): Promise<void> {
        const baseUrl = getBaseUrl();

        // Google Drive Push Notifications require an HTTPS endpoint.
        // In local development (http://localhost) we skip auto-registration;
        // the 1-minute fast-polling fallback still fires the workflow.
        if (
            (config.appType === 'gsheets' || config.appType === 'gdrive') &&
            !baseUrl.startsWith('https://')
        ) {
            return;
        }

        switch (config.appType) {
            case 'gsheets':
            case 'gdrive':
                await this.subscribeGDrive(workflowId, nodeId, config, baseUrl);
                break;
            case 'basecamp':
                await this.subscribeBasecamp(workflowId, nodeId, config, baseUrl);
                break;
        }
    }

    /**
     * Cancel the push subscription for this trigger node and remove the DB record.
     */
    async cancelSubscription(workflowId: string, nodeId: string): Promise<void> {
        const sub = await PushSubscriptionModel.findOne({ workflowId, nodeId });
        if (!sub) return;

        const meta = sub.metadata as Record<string, string>;

        try {
            if (sub.service === 'gsheets' || sub.service === 'gdrive') {
                if (sub.externalId && sub.resourceId && meta.credentialId) {
                    const client = await this.googleAuth.getAuthenticatedClient(meta.credentialId);
                    const token  = (await client.getAccessToken()).token;
                    if (token) {
                        await fetch('https://www.googleapis.com/drive/v3/channels/stop', {
                            method:  'POST',
                            headers: {
                                Authorization:  `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ id: sub.externalId, resourceId: sub.resourceId }),
                        });
                    }
                }
            } else if (sub.service === 'basecamp') {
                if (sub.externalId && meta.credentialId && meta.accountId) {
                    const token = await this.basecampAuth.getToken(meta.credentialId);
                    await fetch(
                        `https://3.basecampapi.com/${meta.accountId}/webhooks/${sub.externalId}.json`,
                        {
                            method:  'DELETE',
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'User-Agent':  'WorkflowAutomation (hello@example.com)',
                            },
                        },
                    );
                }
            }
        } catch { /* best-effort cleanup */ }

        await PushSubscriptionModel.deleteOne({ workflowId, nodeId });
    }

    /**
     * Renew Google Drive subscriptions that expire within the next 2 hours.
     * Call this on an hourly cron.
     */
    async renewExpiring(): Promise<void> {
        const threshold = new Date(Date.now() + 2 * 60 * 60 * 1000);
        const expiring  = await PushSubscriptionModel.find({
            service:   { $in: ['gsheets', 'gdrive'] },
            active:    true,
            expiresAt: { $ne: null, $lt: threshold },
        });

        for (const sub of expiring) {
            const meta = sub.metadata as Record<string, string>;
            if (!meta.credentialId || !meta.resourceTarget) continue;

            await this.ensureSubscription(sub.workflowId, sub.nodeId, {
                triggerType:   'app_event',
                triggerMode:   'instant',
                appType:       sub.service,
                credentialId:  meta.credentialId,
                spreadsheetId: meta.resourceTarget,
                fileId:        meta.resourceTarget,
                folderId:      meta.resourceTarget,
            }).catch((err) =>
                console.error(`[PushSubscriptionService] renewal error ${sub.workflowId}::${sub.nodeId}:`, err)
            );
        }
    }

    // ── Push notification handlers ────────────────────────────────────────────

    /**
     * Called by the /push/gdrive route when Google sends a push notification.
     * Returns whether this was a real change (not the initial sync message).
     */
    isGDriveSyncMessage(resourceState: string): boolean {
        return resourceState === 'sync';
    }

    // ── Private: Google Drive / Sheets ────────────────────────────────────────

    private async subscribeGDrive(
        workflowId: string,
        nodeId:     string,
        config:     TriggerConfig,
        baseUrl:    string,
    ): Promise<void> {
        const { credentialId, appType, eventType, spreadsheetId, fileId, folderId } = config;
        if (!credentialId) return;

        // Determine which Drive resource to watch
        const resourceTarget =
            appType === 'gsheets' ? spreadsheetId :
            eventType === 'file_changed' ? fileId :
            folderId;
        if (!resourceTarget) return;

        const client = await this.googleAuth.getAuthenticatedClient(credentialId);
        const token  = (await client.getAccessToken()).token;
        if (!token) return;

        // Stop existing channel first (idempotent)
        await this.stopGDriveChannel(workflowId, nodeId, credentialId);

        const channelId  = crypto.randomUUID();
        const webhookUrl = `${baseUrl}/push/gdrive/${workflowId}/${nodeId}`;

        const res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${resourceTarget}/watch?supportsAllDrives=true`,
            {
                method:  'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body:    JSON.stringify({ id: channelId, type: 'web_hook', address: webhookUrl }),
            },
        );

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.warn(`[PushSubscriptionService] GDrive watch failed (${res.status}): ${body}`);
            return;
        }

        const data = await res.json() as { id: string; resourceId: string; expiration: string };

        await PushSubscriptionModel.findOneAndUpdate(
            { workflowId, nodeId },
            {
                $set: {
                    workflowId,
                    nodeId,
                    service:    appType ?? 'gdrive',
                    externalId: data.id,
                    resourceId: data.resourceId,
                    expiresAt:  data.expiration ? new Date(Number(data.expiration)) : null,
                    active:     true,
                    metadata:   { credentialId, resourceTarget },
                },
            },
            { upsert: true },
        );
    }

    private async stopGDriveChannel(
        workflowId:   string,
        nodeId:       string,
        credentialId: string,
    ): Promise<void> {
        const existing = await PushSubscriptionModel.findOne({ workflowId, nodeId });
        if (!existing?.externalId) return;

        try {
            const client = await this.googleAuth.getAuthenticatedClient(credentialId);
            const token  = (await client.getAccessToken()).token;
            if (!token) return;

            await fetch('https://www.googleapis.com/drive/v3/channels/stop', {
                method:  'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body:    JSON.stringify({ id: existing.externalId, resourceId: existing.resourceId }),
            });
        } catch { /* ignore */ }
    }

    // ── Private: Basecamp ────────────────────────────────────────────────────

    private async subscribeBasecamp(
        workflowId: string,
        nodeId:     string,
        config:     TriggerConfig,
        baseUrl:    string,
    ): Promise<void> {
        const { credentialId, eventType } = config;
        if (!credentialId) return;

        const token     = await this.basecampAuth.getToken(credentialId);
        const accountId = await this.basecampAuth.getAccountId(credentialId);
        const headers   = {
            Authorization:  `Bearer ${token}`,
            'User-Agent':   'WorkflowAutomation (hello@example.com)',
            'Content-Type': 'application/json',
        };

        // Map event type → Basecamp webhook types
        const TYPE_MAP: Record<string, string[]> = {
            new_todo:       ['Todo'],
            todo_completed: ['Todo'],
            new_message:    ['Message'],
            new_comment:    ['Comment'],
        };
        const types = TYPE_MAP[eventType ?? ''] ?? ['Todo'];

        // Delete any existing webhook for this node
        const existing = await PushSubscriptionModel.findOne({ workflowId, nodeId });
        if (existing?.externalId) {
            await fetch(
                `https://3.basecampapi.com/${accountId}/webhooks/${existing.externalId}.json`,
                { method: 'DELETE', headers },
            ).catch(() => {});
        }

        const webhookUrl = `${baseUrl}/push/basecamp/${workflowId}/${nodeId}`;
        const res = await fetch(
            `https://3.basecampapi.com/${accountId}/webhooks.json`,
            {
                method: 'POST',
                headers,
                body:   JSON.stringify({ payload_url: webhookUrl, types, active: true }),
            },
        );

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.warn(`[PushSubscriptionService] Basecamp webhook failed (${res.status}): ${body}`);
            return;
        }

        const data = await res.json() as { id: number };

        await PushSubscriptionModel.findOneAndUpdate(
            { workflowId, nodeId },
            {
                $set: {
                    workflowId,
                    nodeId,
                    service:    'basecamp',
                    externalId: String(data.id),
                    resourceId: '',
                    expiresAt:  null,          // Basecamp webhooks never expire
                    active:     true,
                    metadata:   { credentialId, accountId },
                },
            },
            { upsert: true },
        );
    }
}
