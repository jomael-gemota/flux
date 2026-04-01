import { Schema, model, Document } from 'mongoose';

export interface TriggerStateDocument extends Document {
    workflowId: string;
    nodeId: string;
    lastPollAt: Date;
    lastSeenId: string;
    metadata: Record<string, unknown>;
}

const TriggerStateSchema = new Schema<TriggerStateDocument>(
    {
        workflowId: { type: String, required: true },
        nodeId:     { type: String, required: true },
        lastPollAt: { type: Date, default: () => new Date() },
        lastSeenId: { type: String, default: '' },
        metadata:   { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

TriggerStateSchema.index({ workflowId: 1, nodeId: 1 }, { unique: true });

export const TriggerStateModel = model<TriggerStateDocument>('TriggerState', TriggerStateSchema);
