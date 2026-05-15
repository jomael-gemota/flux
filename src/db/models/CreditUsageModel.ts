import { Schema, model, Document } from 'mongoose';

export interface CreditModelBreakdown {
    promptTokens: number;
    completionTokens: number;
    credits: number;
}

export interface CreditUsageDocument extends Document {
    /** MongoDB ObjectId string of the platform user. */
    userId: string;
    /** Calendar date in 'YYYY-MM-DD' UTC — the natural daily partition key. */
    date: string;
    /** Running total credits consumed today. */
    creditsUsed: number;
    /** Per-model breakdown so the admin dashboard can show cost by model. */
    breakdown: Record<string, CreditModelBreakdown>;
    createdAt: Date;
    updatedAt: Date;
}

const CreditUsageSchema = new Schema<CreditUsageDocument>(
    {
        userId:      { type: String, required: true, index: true },
        date:        { type: String, required: true, index: true },
        creditsUsed: { type: Number, required: true, default: 0 },
        breakdown:   { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true },
);

/** Compound unique index — one document per user per day. */
CreditUsageSchema.index({ userId: 1, date: 1 }, { unique: true });

export const CreditUsageModel = model<CreditUsageDocument>('CreditUsage', CreditUsageSchema);
