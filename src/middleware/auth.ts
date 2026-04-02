import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiKeyModel } from '../db/models/ApiKeyModel';
import { UnauthorizedError, ForbiddenError } from '../errors/ApiError';
import type { JwtPayload } from '../types/auth.types';

/**
 * Accepts EITHER:
 *   - Authorization: Bearer <jwt>   (UI / Google-auth users)
 *   - x-api-key: <key>              (programmatic / backward-compat)
 *
 * Attaches `request.authUser` (JWT path) or `request.apiKey` (API-key path).
 */
export async function combinedAuth(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void> {
    const bearer = request.headers['authorization'];

    if (bearer && bearer.startsWith('Bearer ')) {
        // JWT path — @fastify/jwt verifies and attaches request.user
        try {
            await (request as any).jwtVerify();
            const jwtUser = (request as any).user as JwtPayload;

            // Only approved users may access the API
            if (jwtUser.status !== 'approved') {
                throw ForbiddenError('Your account is pending approval');
            }
            return;
        } catch (err: any) {
            if (err.statusCode === 403) throw err;
            throw UnauthorizedError(err.message ?? 'Invalid or expired token');
        }
    }

    // API-key fallback
    const apiKey = request.headers['x-api-key'];
    if (apiKey && typeof apiKey === 'string') {
        const doc = await ApiKeyModel.findOne({ key: apiKey });
        if (!doc) throw ForbiddenError();
        (request as any).apiKey = { id: doc.keyId, key: doc.key, name: doc.name };
        return;
    }

    throw UnauthorizedError();
}

/** Legacy export kept so existing route files that import apiKeyAuth still compile */
export const apiKeyAuth = combinedAuth;
