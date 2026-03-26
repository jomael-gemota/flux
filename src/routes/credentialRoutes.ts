import { FastifyInstance } from 'fastify';
import { apiKeyAuth } from '../middleware/auth';
import { CredentialRepository } from '../repositories/CredentialRepository';
import { NotFoundError } from '../errors/ApiError';

export async function credentialRoutes(
    fastify: FastifyInstance,
    options: { credentialRepo: CredentialRepository }
): Promise<void> {
    const { credentialRepo } = options;

    /** List all connected credentials (tokens are never returned) */
    fastify.get('/credentials', { preHandler: apiKeyAuth }, async (_request, reply) => {
        const list = await credentialRepo.findAll();
        return reply.code(200).send(list);
    });

    /** Delete (disconnect) a credential */
    fastify.delete<{ Params: { id: string } }>(
        '/credentials/:id',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            const deleted = await credentialRepo.deleteById(request.params.id);
            if (!deleted) throw NotFoundError(`Credential ${request.params.id}`);
            return reply.code(200).send({ deleted: true, id: request.params.id });
        }
    );
}
