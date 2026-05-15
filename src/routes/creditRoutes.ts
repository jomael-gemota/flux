import type { FastifyInstance } from 'fastify';
import type { CreditService } from '../services/CreditService';
import type { JwtPayload } from '../types/auth.types';

interface CreditRouteOptions {
    creditService: CreditService;
}

async function jwtAuth(req: any, reply: any) {
    try { await req.jwtVerify(); }
    catch (err) { reply.send(err); }
}

async function ownerOnly(req: any, reply: any) {
    await req.jwtVerify();
    const user = req.user as JwtPayload;
    if (user.role !== 'owner') {
        reply.code(403).send({ message: 'Platform Owner access required' });
    }
}

export async function creditRoutes(
    fastify: FastifyInstance,
    opts: CreditRouteOptions,
) {
    const { creditService } = opts;

    // ── User-facing ──────────────────────────────────────────────────────────

    /** Returns the authenticated user's credit snapshot for today. */
    fastify.get(
        '/me/credits',
        { preHandler: [jwtAuth] },
        async (req) => {
            const user = (req as any).user as JwtPayload;
            return creditService.getSnapshot(user.sub);
        },
    );

    // ── Admin-only ───────────────────────────────────────────────────────────

    /** List all credit limit settings (per-user overrides + global default). */
    fastify.get(
        '/admin/credits/settings',
        { preHandler: [ownerOnly] },
        async () => {
            const settings = await creditService.listSettings();
            return { settings };
        },
    );

    /**
     * Upsert a daily credit limit for a specific user OR for `"default"` which
     * acts as the global fallback for every user without an individual override.
     */
    fastify.put<{
        Params: { userId: string };
        Body:   { dailyLimit: number };
    }>(
        '/admin/credits/settings/:userId',
        { preHandler: [ownerOnly] },
        async (req, reply) => {
            const { userId }     = req.params;
            const { dailyLimit } = req.body ?? {};
            const owner = (req as any).user as JwtPayload;

            if (typeof dailyLimit !== 'number' || dailyLimit < 0) {
                return reply.code(400).send({ message: 'dailyLimit must be a non-negative number' });
            }

            await creditService.setDailyLimit(userId, dailyLimit, owner.sub);
            return { ok: true, userId, dailyLimit };
        },
    );

    /**
     * Remove a per-user limit override, reverting the user to the global
     * default. The special `"default"` record cannot be deleted.
     */
    fastify.delete<{ Params: { userId: string } }>(
        '/admin/credits/settings/:userId',
        { preHandler: [ownerOnly] },
        async (req, reply) => {
            const { userId } = req.params;
            if (userId === 'default') {
                return reply.code(400).send({
                    message: 'Cannot delete the global default — use PUT to update it instead.',
                });
            }
            await creditService.deleteDailyLimitOverride(userId);
            return { deleted: true, userId };
        },
    );

    /**
     * Return all users' credit consumption for a given date.
     * Defaults to today (UTC) when `?date=` is omitted.
     */
    fastify.get<{ Querystring: { date?: string } }>(
        '/admin/credits/usage',
        { preHandler: [ownerOnly] },
        async (req) => {
            const { date } = req.query;
            const usage = await creditService.listUsage(date);
            return { usage, date: date ?? new Date().toISOString().slice(0, 10) };
        },
    );
}
