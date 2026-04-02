import type { FastifyInstance } from 'fastify';
import { UserAuthService } from '../services/UserAuthService';
import { getBaseUrl } from '../utils/baseUrl';

interface AuthRouteOptions {
    userAuth: UserAuthService;
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
            const frontendBase = getBaseUrl();

            if (error || !code) {
                return reply.redirect(`${frontendBase}/?auth_error=access_denied`);
            }

            try {
                const user = await userAuth.handleCallback(code);
                const payload = userAuth.toJwtPayload(user);
                // Sign a 7-day JWT using the @fastify/jwt plugin
                const token = (fastify as any).jwt.sign(payload, { expiresIn: '7d' });
                // Pass token to the SPA via URL fragment — never lands in server logs
                reply.redirect(`${frontendBase}/?auth_token=${token}`);
            } catch (err) {
                fastify.log.error(err, 'Google auth callback error');
                const msg = err instanceof Error ? encodeURIComponent(err.message) : 'unknown';
                reply.redirect(`${getBaseUrl()}/?auth_error=${msg}`);
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
            const freshToken = (fastify as any).jwt.sign(payload, { expiresIn: '7d' });
            return { user, token: freshToken };
        },
    );
}
