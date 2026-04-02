import { Schema, model, Document } from 'mongoose';
import type { UserRole, UserStatus } from '../../types/auth.types';

export interface UserDocument extends Document {
    googleId: string;
    email: string;
    name: string;
    avatar?: string;
    role: UserRole;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
    {
        googleId: { type: String, required: true, unique: true, index: true },
        email:    { type: String, required: true, unique: true, index: true },
        name:     { type: String, required: true },
        avatar:   { type: String },
        role:     { type: String, enum: ['owner', 'user'], default: 'user' },
        status:   { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    },
    { timestamps: true }
);

export const UserModel = model<UserDocument>('User', UserSchema);
