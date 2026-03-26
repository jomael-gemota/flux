import { Schema, model, Document } from 'mongoose';

export interface CredentialDocument extends Document {
    provider: 'google';
    label: string;
    email: string;
    accessToken: string;
    refreshToken: string;
    expiryDate: number;   // Unix ms timestamp
    scopes: string[];
}

const CredentialSchema = new Schema<CredentialDocument>(
    {
        provider: { type: String, enum: ['google'], required: true },
        label:    { type: String, required: true },
        email:    { type: String, required: true },
        accessToken:  { type: String, required: true },
        refreshToken: { type: String, required: true },
        expiryDate:   { type: Number, required: true },
        scopes: [{ type: String }],
    },
    { timestamps: true }
);

export const CredentialModel = model<CredentialDocument>('Credential', CredentialSchema);
