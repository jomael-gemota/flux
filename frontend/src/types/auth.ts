export type UserRole   = 'owner' | 'user';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role: UserRole;
    status: UserStatus;
    createdAt: string;
}
