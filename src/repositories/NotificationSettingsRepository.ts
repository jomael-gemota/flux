import { NotificationSettingsModel, type NotificationSettingsDocument, type WorkflowNotifOverride } from '../db/models/NotificationSettingsModel';

export type { WorkflowNotifOverride };

export class NotificationSettingsRepository {
    /**
     * Return the notification settings for a specific user, auto-creating a
     * fresh default record on first access so callers never receive null.
     *
     * `key` is set equal to `userId` so that each document has a unique `key`
     * value.  This keeps the legacy `{ key: 1, unique: true }` MongoDB index
     * satisfied without requiring a manual index migration.
     */
    async get(userId: string): Promise<NotificationSettingsDocument> {
        const existing = await NotificationSettingsModel.findOne({ userId });
        if (existing) return existing;
        return NotificationSettingsModel.create({ key: userId, userId });
    }

    async update(
        patch: {
            enabled?: boolean;
            notifyOnFailure?: boolean;
            notifyOnPartial?: boolean;
            notifyOnSuccess?: boolean;
            recipients?: string[];
        },
        userId: string,
    ): Promise<NotificationSettingsDocument> {
        const doc = await NotificationSettingsModel.findOneAndUpdate(
            { userId },
            { $set: patch, $setOnInsert: { key: userId } },
            { new: true, upsert: true },
        );
        return doc!;
    }

    /**
     * Upsert the per-workflow recipient override for a single workflow.
     * Uses MongoDB dot-notation so only the targeted key in the Mixed object is
     * touched — all other workflow overrides remain unchanged.
     */
    async setWorkflowOverride(
        userId: string,
        workflowId: string,
        override: WorkflowNotifOverride,
    ): Promise<NotificationSettingsDocument> {
        const doc = await NotificationSettingsModel.findOneAndUpdate(
            { userId },
            {
                $set: { [`workflowOverrides.${workflowId}`]: override, key: userId },
            },
            { new: true, upsert: true },
        );
        return doc!;
    }
}
