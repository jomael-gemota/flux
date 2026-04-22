import { Schema, model, Document } from 'mongoose';

export interface PushSubscriptionDocument extends Document {
    workflowId:  string;
    nodeId:      string;
    /** Which service owns this subscription (gsheets, gdrive, basecamp, …) */
    service:     string;
    /** Channel/subscription/webhook ID returned by the external service */
    externalId:  string;
    /** Google Drive's internal resource ID (needed to stop the channel) */
    resourceId:  string;
    /** When this subscription expires; null = never (e.g. Basecamp) */
    expiresAt:   Date | null;
    active:      boolean;
    /** Service-specific data (credentialId, accountId, resource target, …) */
    metadata:    Record<string, unknown>;
}

const schema = new Schema<PushSubscriptionDocument>(
    {
        workflowId: { type: String, required: true },
        nodeId:     { type: String, required: true },
        service:    { type: String, required: true },
        externalId: { type: String, default: '' },
        resourceId: { type: String, default: '' },
        expiresAt:  { type: Date,   default: null },
        active:     { type: Boolean, default: true },
        metadata:   { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true },
);

schema.index({ workflowId: 1, nodeId: 1 }, { unique: true });

export const PushSubscriptionModel = model<PushSubscriptionDocument>(
    'PushSubscription',
    schema,
);
