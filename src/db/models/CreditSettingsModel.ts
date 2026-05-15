import { Schema, model, Document } from 'mongoose';

export interface CreditSettingsDocument extends Document {
    /**
     * The platform user's MongoDB ObjectId string, OR the special literal
     * `"default"` which acts as the global fallback for all users without
     * an individual override.
     */
    userId: string;
    /** Maximum credits the user may consume in a single calendar day (UTC). */
    dailyLimit: number;
    /** ObjectId string of the owner who last changed this setting (for audit). */
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const CreditSettingsSchema = new Schema<CreditSettingsDocument>(
    {
        userId:     { type: String, required: true, unique: true, index: true },
        dailyLimit: { type: Number, required: true },
        updatedBy:  { type: String, required: true },
    },
    { timestamps: true },
);

export const CreditSettingsModel = model<CreditSettingsDocument>(
    'CreditSettings',
    CreditSettingsSchema,
);
