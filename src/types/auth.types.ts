export type UserRole   = 'owner' | 'user';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface AuthUser {
    id: string;
    googleId: string;
    email: string;
    name: string;
    avatar?: string;
    role: UserRole;
    status: UserStatus;
    createdAt: Date;
}

/** Shape stored in the JWT payload */
export interface JwtPayload {
    sub: string;      // MongoDB ObjectId as string
    email: string;
    role: UserRole;
    status: UserStatus;
}
