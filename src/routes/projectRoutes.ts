import { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { apiKeyAuth } from '../middleware/auth';
import { ProjectModel } from '../db/models/ProjectModel';

/** Returns the authenticated user's MongoDB id, or undefined for API-key requests. */
function getRequestUserId(request: FastifyRequest): string | undefined {
    return (request as any).user?.sub ?? undefined;
}

function requireUserId(request: FastifyRequest): string {
    const id = getRequestUserId(request);
    if (!id) throw { statusCode: 401, message: 'JWT authentication required for project operations' };
    return id;
}

function toDTO(doc: InstanceType<typeof ProjectModel>) {
    return { id: doc.projectId, name: doc.name, workflowIds: doc.workflowIds as string[] };
}

export async function projectRoutes(fastify: FastifyInstance): Promise<void> {

    // ── GET /projects ─────────────────────────────────────────────────────────
    fastify.get(
        '/projects',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            const userId = requireUserId(request);
            const docs = await ProjectModel.find({ userId }).sort({ createdAt: 1 });
            return reply.code(200).send(docs.map(toDTO));
        }
    );

    // ── POST /projects ────────────────────────────────────────────────────────
    fastify.post(
        '/projects',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            const userId = requireUserId(request);
            const body = request.body as { name?: string; workflowIds?: string[]; id?: string };

            const name = body.name?.trim();
            if (!name) return reply.code(400).send({ message: 'name is required' });

            const projectId = body.id ?? `proj-${crypto.randomUUID()}`;
            const doc = await ProjectModel.create({
                projectId,
                name,
                workflowIds: body.workflowIds ?? [],
                userId,
            });

            return reply.code(201).send(toDTO(doc));
        }
    );

    // ── PUT /projects/:id ─────────────────────────────────────────────────────
    fastify.put<{ Params: { id: string } }>(
        '/projects/:id',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            const userId = requireUserId(request);
            const body   = request.body as { name?: string; workflowIds?: string[] };

            const update: Record<string, unknown> = {};
            if (body.name        !== undefined) update.name        = body.name.trim();
            if (body.workflowIds !== undefined) update.workflowIds = body.workflowIds;

            const doc = await ProjectModel.findOneAndUpdate(
                { projectId: request.params.id, userId },
                { $set: update },
                { new: true }
            );

            if (!doc) return reply.code(404).send({ message: 'Project not found' });
            return reply.code(200).send(toDTO(doc));
        }
    );

    // ── DELETE /projects/:id ──────────────────────────────────────────────────
    fastify.delete<{ Params: { id: string } }>(
        '/projects/:id',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            const userId = requireUserId(request);
            const result = await ProjectModel.deleteOne({ projectId: request.params.id, userId });

            if (result.deletedCount === 0) {
                return reply.code(404).send({ message: 'Project not found' });
            }
            return reply.code(200).send({ deleted: true, id: request.params.id });
        }
    );
}
