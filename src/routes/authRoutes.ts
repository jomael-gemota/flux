import type { FastifyInstance } from 'fastify';
import { UserAuthService } from '../services/UserAuthService';
import { getBaseUrl } from '../utils/baseUrl';

interface AuthRouteOptions {
    userAuth: UserAuthService;
}

/**
 * Returns the URL the browser should be redirected to after auth.
 *
 * - Development: frontend Vite dev-server lives on a different port than the
 *   backend, so we use CORS_ORIGIN (e.g. http://localhost:5173).
 * - Production: frontend is served by the backend itself, so both share the
 *   same origin — getBaseUrl() is correct.
 */
function getFrontendUrl(): string {
    return (process.env.CORS_ORIGIN ?? getBaseUrl()).replace(/\/$/, '');
}

export async function authRoutes(
    fastify: FastifyInstance,
    { userAuth }: AuthRouteOptions,
) {
    /** Redirect browser to Google's consent screen */
    fastify.get('/auth/google', async (_req, reply) => {
        const url = userAuth.getAuthUrl();
        reply.redirect(url);
    });

    /** Google redirects here after user consents */
    fastify.get<{ Querystring: { code?: string; error?: string } }>(
        '/auth/google/callback',
        async (req, reply) => {
            const { code, error } = req.query;
            const frontendBase = getFrontendUrl();

            if (error || !code) {
                return reply.redirect(`${frontendBase}/?auth_error=access_denied`);
            }

            try {
                const user = await userAuth.handleCallback(code);
                const payload = userAuth.toJwtPayload(user);
                const token = (fastify as any).jwt.sign(payload, { expiresIn: '8h' });
                reply.redirect(`${frontendBase}/?auth_token=${token}`);
            } catch (err) {
                fastify.log.error(err, 'Google auth callback error');
                const msg = err instanceof Error ? encodeURIComponent(err.message) : 'unknown';
                reply.redirect(`${frontendBase}/?auth_error=${msg}`);
            }
        },
    );

    /** Returns the current user from their JWT — requires auth */
    fastify.get(
        '/auth/me',
        { preHandler: [(fastify as any).authenticate] },
        async (req, reply) => {
            const jwtUser = (req as any).user as { sub: string };
            const user = await userAuth.getUserById(jwtUser.sub);
            if (!user) return reply.code(404).send({ message: 'User not found' });

            // Re-sign with fresh status in case it was just updated
            const payload = userAuth.toJwtPayload(user);
            const freshToken = (fastify as any).jwt.sign(payload, { expiresIn: '8h' });
            return { user, token: freshToken };
        },
    );
}
