import { Schema, model, Document } from 'mongoose';

export interface NotificationSettingsDocument extends Document {
    /**
     * Set to the owning user's MongoDB ObjectId string on creation (mirrors userId).
     * This field exists solely to stay compatible with the legacy `{ key: 1, unique: true }`
     * MongoDB index that was created when the collection used a global singleton pattern.
     * Because key === userId, the old index is always satisfied without a manual migration.
     */
    key: string;
    /** MongoDB ObjectId string of the owning user. One settings document per user. */
    userId: string;
    enabled: boolean;
    /** Notify when the entire workflow fails (status === 'failure') */
    notifyOnFailure: boolean;
    /** Notify when at least one node fails but others succeeded (status === 'partial') */
    notifyOnPartial: boolean;
    /** Notify when a workflow completes successfully (status === 'success') */
    notifyOnSuccess: boolean;
    /** List of recipient email addresses (owner email is always included and cannot be removed) */
    recipients: string[];
    updatedAt: Date;
}

const NotificationSettingsSchema = new Schema<NotificationSettingsDocument>(
    {
        key:             { type: String, required: true },
        userId:          { type: String, required: true },
        enabled:         { type: Boolean, required: true, default: false },
        notifyOnFailure: { type: Boolean, required: true, default: true },
        notifyOnPartial: { type: Boolean, required: true, default: true },
        notifyOnSuccess: { type: Boolean, required: true, default: false },
        recipients:      { type: [String], required: true, default: [] },
    },
    { timestamps: true }
);

// Each user has exactly one settings document.
NotificationSettingsSchema.index({ key: 1, userId: 1 }, { unique: true });

export const NotificationSettingsModel = model<NotificationSettingsDocument>(
    'NotificationSettings',
    NotificationSettingsSchema
);
