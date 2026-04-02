import type { FastifyInstance } from 'fastify';
import { UserModel } from '../db/models/UserModel';
import type { JwtPayload, UserRole, UserStatus } from '../types/auth.types';

interface AdminRouteOptions {}

/** Middleware: request must carry a valid JWT with role === 'owner' */
async function ownerOnly(req: any, reply: any) {
    await req.jwtVerify();
    const user = req.user as JwtPayload;
    if (user.role !== 'owner') {
        reply.code(403).send({ message: 'Platform Owner access required' });
    }
}

export async function adminRoutes(
    fastify: FastifyInstance,
    _opts: AdminRouteOptions,
) {
    /** List all users */
    fastify.get(
        '/admin/users',
        { preHandler: [ownerOnly] },
        async () => {
            const users = await UserModel.find().sort({ createdAt: -1 }).lean();
            return users.map((u) => ({
                id:        u._id.toString(),
                email:     u.email,
                name:      u.name,
                avatar:    u.avatar,
                role:      u.role,
                status:    u.status,
                createdAt: u.createdAt,
            }));
        },
    );

    /** Update a user's status (approve / reject) */
    fastify.patch<{
        Params: { id: string };
        Body: { status?: UserStatus; role?: UserRole };
    }>(
        '/admin/users/:id',
        { preHandler: [ownerOnly] },
        async (req, reply) => {
            const { id } = req.params;
            const { status, role } = req.body;
            const self = (req as any).user as JwtPayload;

            // Prevent an owner from demoting themselves
            if (self.sub === id && role && role !== 'owner') {
                return reply.code(400).send({ message: 'Cannot demote yourself' });
            }

            const updates: Partial<{ status: UserStatus; role: UserRole }> = {};
            if (status) updates.status = status;
            if (role)   updates.role   = role;

            const updated = await UserModel.findByIdAndUpdate(id, updates, { new: true }).lean();
            if (!updated) return reply.code(404).send({ message: 'User not found' });

            return {
                id:     updated._id.toString(),
                email:  updated.email,
                name:   updated.name,
                role:   updated.role,
                status: updated.status,
            };
        },
    );

    /** Delete a user */
    fastify.delete<{ Params: { id: string } }>(
        '/admin/users/:id',
        { preHandler: [ownerOnly] },
        async (req, reply) => {
            const { id } = req.params;
            const self = (req as any).user as JwtPayload;
            if (self.sub === id) {
                return reply.code(400).send({ message: 'Cannot delete your own account' });
            }
            await UserModel.findByIdAndDelete(id);
            return { deleted: true };
        },
    );

    /** Summary counts for the Owner dashboard badge */
    fastify.get(
        '/admin/stats',
        { preHandler: [ownerOnly] },
        async () => {
            const [total, pending, approved] = await Promise.all([
                UserModel.countDocuments(),
                UserModel.countDocuments({ status: 'pending' }),
                UserModel.countDocuments({ status: 'approved' }),
            ]);
            return { total, pending, approved };
        },
    );
}
