import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { CredentialRepository } from '../repositories/CredentialRepository';

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
];

export class GoogleAuthService {
    private credentialRepo: CredentialRepository;

    constructor(credentialRepo: CredentialRepository) {
        this.credentialRepo = credentialRepo;
    }

    private createOAuth2Client(): OAuth2Client {
        return new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
    }

    /** Returns the Google consent page URL */
    getAuthUrl(): string {
        const client = this.createOAuth2Client();
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent',   // always show consent to guarantee refresh_token
        });
    }

    /** Exchange an authorization code for tokens and return the user's email */
    async exchangeCode(code: string): Promise<{
        email: string;
        accessToken: string;
        refreshToken: string;
        expiryDate: number;
    }> {
        const client = this.createOAuth2Client();
        const { tokens } = await client.getToken(code);

        if (!tokens.access_token || !tokens.refresh_token) {
            throw new Error('Google OAuth did not return expected tokens');
        }

        client.setCredentials(tokens);

        // Fetch the account email via the userinfo endpoint
        const oauth2 = google.oauth2({ version: 'v2', auth: client });
        const { data } = await oauth2.userinfo.get();

        return {
            email:        data.email ?? 'unknown@google.com',
            accessToken:  tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate:   tokens.expiry_date ?? Date.now() + 3600 * 1000,
        };
    }

    /**
     * Returns an authenticated OAuth2Client for the given stored credential.
     * Automatically refreshes the access token when it is expired.
     */
    async getAuthenticatedClient(credentialId: string): Promise<OAuth2Client> {
        const cred = await this.credentialRepo.findById(credentialId);
        if (!cred) {
            throw new Error(`Credential "${credentialId}" not found. Connect your Google account first.`);
        }

        const client = this.createOAuth2Client();
        client.setCredentials({
            access_token:  cred.accessToken,
            refresh_token: cred.refreshToken,
            expiry_date:   cred.expiryDate,
        });

        // If token is expired (or within 60 s of expiry), refresh it
        const isExpired = cred.expiryDate < Date.now() + 60_000;
        if (isExpired) {
            const { credentials } = await client.refreshAccessToken();
            await this.credentialRepo.updateTokens(credentialId, {
                accessToken:  credentials.access_token!,
                refreshToken: credentials.refresh_token ?? cred.refreshToken,
                expiryDate:   credentials.expiry_date ?? Date.now() + 3600 * 1000,
            });
            client.setCredentials(credentials);
        }

        return client;
    }
}
