import { OAuth2Client } from 'google-auth-library';
import { UserModel } from '../db/models/UserModel';
import { getBaseUrl } from '../utils/baseUrl';
import type { AuthUser, JwtPayload } from '../types/auth.types';

/** Google account emails that are automatically granted Platform Owner status */
const DEFAULT_OWNERS = ['jomaelgemota@gmail.com'];

const AUTH_SCOPES = ['openid', 'email', 'profile'];

function getRedirectUri(): string {
    return `${getBaseUrl()}/api/auth/google/callback`;
}

function buildOAuthClient(): OAuth2Client {
    return new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        getRedirectUri(),
    );
}

export class UserAuthService {
    /** Returns the Google OAuth consent URL the browser should redirect to */
    getAuthUrl(): string {
        const client = buildOAuthClient();
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: AUTH_SCOPES,
            prompt: 'select_account',
        });
    }

    /**
     * Exchanges the Google auth code for tokens, looks up or creates the user,
     * and returns the user document.
     */
    async handleCallback(code: string): Promise<AuthUser> {
        const client = buildOAuthClient();
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);

        // Fetch Google profile
        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token!,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.sub || !payload.email) {
            throw new Error('Invalid Google token payload');
        }

        const { sub: googleId, email, name = email, picture: avatar } = payload;

        // Find or create the user
        let user = await UserModel.findOne({ googleId });

        if (!user) {
            const isDefaultOwner = DEFAULT_OWNERS.includes(email.toLowerCase());
            user = await UserModel.create({
                googleId,
                email,
                name,
                avatar,
                role:   isDefaultOwner ? 'owner'    : 'user',
                status: isDefaultOwner ? 'approved' : 'pending',
            });
        } else {
            // Keep profile info fresh
            user.name   = name;
            user.avatar = avatar;
            await user.save();
        }

        return this.toAuthUser(user);
    }

    async getUserById(id: string): Promise<AuthUser | null> {
        const user = await UserModel.findById(id);
        return user ? this.toAuthUser(user) : null;
    }

    /** Builds a JWT payload from an AuthUser (used by the route to sign the token) */
    toJwtPayload(user: AuthUser): JwtPayload {
        return { sub: user.id, email: user.email, role: user.role, status: user.status };
    }

    private toAuthUser(doc: InstanceType<typeof UserModel>): AuthUser {
        return {
            id:        (doc._id as any).toString(),
            googleId:  doc.googleId,
            email:     doc.email,
            name:      doc.name,
            avatar:    doc.avatar,
            role:      doc.role,
            status:    doc.status,
            createdAt: doc.createdAt,
        };
    }
}
